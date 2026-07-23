import {
  constants as fsConstants,
  existsSync,
  lstatSync,
  promises as fsPromises,
  realpathSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  basename as pathBasename,
  dirname as pathDirname,
  isAbsolute as pathIsAbsolute,
  join as pathJoin,
  relative as pathRelative,
  resolve as pathResolve,
} from "node:path";
import {
  bytesFromUint8Array,
  latin1FromBytes,
  type ByteString,
  unsafeBytesFromLatin1,
  uint8ArrayFromBytes,
} from "./encoding";
import type {
  BufferEncoding,
  CpOptions,
  DirentEntry,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  ReadFileOptions,
  RmOptions,
  WriteFileOptions,
} from "./fs";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function assertValidPath(path: string, operation: string): void {
  if (path.includes("\0")) {
    throw new Error(`ENOENT: path contains null byte, ${operation} '${path}'`);
  }
}

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  const trimmed = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  const absolute = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const parts: string[] = [];
  for (const part of absolute.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const slash = normalized.lastIndexOf("/");
  return slash <= 0 ? "/" : normalized.slice(0, slash);
}

function joinPath(base: string, child: string): string {
  return normalizePath(base === "/" ? `/${child}` : `${base}/${child}`);
}

function getEncoding(options?: ReadFileOptions | WriteFileOptions | BufferEncoding): BufferEncoding {
  if (typeof options === "string") return options;
  return options?.encoding ?? "utf8";
}

function encodeFileContent(content: FileContent, encoding: BufferEncoding): Uint8Array {
  if (content instanceof Uint8Array) return content;
  switch (encoding) {
    case "binary":
    case "latin1":
      return uint8ArrayFromBytes(unsafeBytesFromLatin1(content));
    case "base64":
      return decodeBase64(content);
    case "hex":
      return decodeHex(content);
    case "ascii":
      return Uint8Array.from(content, (char) => char.charCodeAt(0) & 0x7f);
    case "utf-8":
    case "utf8":
    default:
      return textEncoder.encode(content);
  }
}

function decodeFileContent(content: Uint8Array, encoding: BufferEncoding): string {
  switch (encoding) {
    case "binary":
    case "latin1":
      return latin1FromBytes(bytesFromUint8Array(content));
    case "base64":
      return encodeBase64(content);
    case "hex":
      return encodeHex(content);
    case "ascii":
      return asciiFromBytes(content);
    case "utf-8":
    case "utf8":
    default:
      return textDecoder.decode(content);
  }
}

function asciiFromBytes(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte & 0x7f);
  return out;
}

function decodeHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const size = Math.floor(clean.length / 2);
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const parsed = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    out[i] = Number.isFinite(parsed) ? parsed : 0;
  }
  return out;
}

function encodeHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function decodeBase64(input: string): Uint8Array {
  if (typeof atob === "function") {
    const raw = atob(input);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  }
  const bufferCtor = (globalThis as { Buffer?: { from(data: string, encoding: "base64"): Uint8Array } }).Buffer;
  if (bufferCtor) return Uint8Array.from(bufferCtor.from(input, "base64"));
  throw new Error("base64 decoding is not available in this runtime");
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let raw = "";
    for (const byte of bytes) raw += String.fromCharCode(byte);
    return btoa(raw);
  }
  const bufferCtor = (globalThis as { Buffer?: { from(data: Uint8Array): { toString(encoding: "base64"): string } } }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString("base64");
  throw new Error("base64 encoding is not available in this runtime");
}

function isPathWithinRoot(path: string, root: string): boolean {
  if (path === root) return true;
  const relative = pathRelative(root, path);
  return relative !== "" && !relative.startsWith("..") && !pathIsAbsolute(relative);
}

function nearestExistingParent(path: string): string | null {
  let current = path;
  while (!existsSync(current)) {
    const parent = pathDirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function toVirtualPath(realPath: string, canonicalRoot: string): string {
  const relative = pathRelative(canonicalRoot, realPath).replace(/\\/g, "/");
  return relative ? `/${relative}` : "/";
}

function errCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export interface ReadWriteFsOptions {
  root: string;
  maxFileReadSize?: number;
  allowSymlinks?: boolean;
}

export class ReadWriteFs implements IFileSystem {
  private readonly root: string;
  private readonly canonicalRoot: string;
  private readonly maxFileReadSize: number;
  private readonly allowSymlinks: boolean;

  constructor(readonly options: ReadWriteFsOptions) {
    this.root = pathResolve(options.root);
    if (!existsSync(this.root)) {
      throw new Error("ReadWriteFs root does not exist");
    }
    if (!statSync(this.root).isDirectory()) {
      throw new Error("ReadWriteFs root is not a directory");
    }
    this.canonicalRoot = realpathSync(this.root);
    this.maxFileReadSize = options.maxFileReadSize ?? 10 * 1024 * 1024;
    this.allowSymlinks = options.allowSymlinks ?? false;
  }

  private toRealPath(path: string): string {
    const normalized = normalizePath(path);
    return pathResolve(pathJoin(this.root, normalized));
  }

  private resolveAndValidate(realPath: string, virtualPath: string): string {
    const nearest = nearestExistingParent(realPath);
    if (!nearest) {
      throw new Error(`EACCES: permission denied, '${virtualPath}' resolves outside sandbox`);
    }
    let canonicalNearest: string;
    try {
      canonicalNearest = realpathSync(nearest);
    } catch {
      throw new Error(`EACCES: permission denied, '${virtualPath}' resolves outside sandbox`);
    }
    if (!isPathWithinRoot(canonicalNearest, this.canonicalRoot)) {
      throw new Error(`EACCES: permission denied, '${virtualPath}' resolves outside sandbox`);
    }

    if (!this.allowSymlinks) {
      const unresolvedRelative = pathRelative(this.root, pathResolve(realPath)).replace(/\\/g, "/");
      const resolvedCandidate = nearest === realPath
        ? canonicalNearest
        : pathJoin(canonicalNearest, pathRelative(nearest, realPath));
      const resolvedRelative = pathRelative(this.canonicalRoot, resolvedCandidate).replace(/\\/g, "/");
      if (unresolvedRelative !== resolvedRelative) {
        throw new Error(`EACCES: permission denied, '${virtualPath}' resolves outside sandbox`);
      }
      try {
        if (lstatSync(realPath).isSymbolicLink()) {
          throw new Error(`EACCES: permission denied, '${virtualPath}' is a symlink`);
        }
      } catch (error) {
        if (errCode(error) !== "ENOENT") {
          throw error;
        }
      }
    }

    const resolved = nearest === realPath
      ? canonicalNearest
      : pathJoin(canonicalNearest, pathRelative(nearest, realPath));
    if (!isPathWithinRoot(pathResolve(resolved), this.canonicalRoot)) {
      throw new Error(`EACCES: permission denied, '${virtualPath}' resolves outside sandbox`);
    }
    return resolved;
  }

  private validateParent(realPath: string, virtualPath: string): string {
    const parent = this.resolveAndValidate(pathDirname(realPath), virtualPath);
    return pathJoin(parent, pathBasename(realPath));
  }

  async readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
    return decodeFileContent(await this.readFileBuffer(path), getEncoding(options));
  }

  async readFileBytes(path: string): Promise<ByteString> {
    return bytesFromUint8Array(await this.readFileBuffer(path));
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    assertValidPath(path, "open");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
    try {
      handle = await fsPromises.open(
        realPath,
        this.allowSymlinks ? fsConstants.O_RDONLY : fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      if (this.maxFileReadSize > 0) {
        const stat = await handle.stat();
        if (stat.size > this.maxFileReadSize) {
          throw new Error(`EFBIG: file too large, read '${path}' (${stat.size} bytes, max ${this.maxFileReadSize})`);
        }
      }
      return new Uint8Array(await handle.readFile());
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      if (code === "EISDIR") {
        throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
      }
      if (code === "ELOOP") {
        throw new Error(`EACCES: permission denied, '${path}' is a symlink`);
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async writeFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    assertValidPath(path, "write");
    const realInput = this.toRealPath(path);
    let realPath = this.resolveAndValidate(realInput, path);
    const bytes = encodeFileContent(content, getEncoding(options));
    await fsPromises.mkdir(pathDirname(realPath), { recursive: true });
    realPath = this.resolveAndValidate(realInput, path);
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
    try {
      handle = await fsPromises.open(
        realPath,
        fsConstants.O_WRONLY |
          fsConstants.O_CREAT |
          fsConstants.O_TRUNC |
          (this.allowSymlinks ? 0 : fsConstants.O_NOFOLLOW),
        0o666,
      );
      await handle.writeFile(bytes);
    } catch (error) {
      if (errCode(error) === "ELOOP") {
        throw new Error(`EACCES: permission denied, '${path}' is a symlink`);
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async appendFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    assertValidPath(path, "append");
    const realInput = this.toRealPath(path);
    let realPath = this.resolveAndValidate(realInput, path);
    const bytes = encodeFileContent(content, getEncoding(options));
    await fsPromises.mkdir(pathDirname(realPath), { recursive: true });
    realPath = this.resolveAndValidate(realInput, path);
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
    try {
      handle = await fsPromises.open(
        realPath,
        fsConstants.O_WRONLY |
          fsConstants.O_CREAT |
          fsConstants.O_APPEND |
          (this.allowSymlinks ? 0 : fsConstants.O_NOFOLLOW),
        0o666,
      );
      await handle.writeFile(bytes);
    } catch (error) {
      if (errCode(error) === "ELOOP") {
        throw new Error(`EACCES: permission denied, '${path}' is a symlink`);
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async exists(path: string): Promise<boolean> {
    if (path.includes("\0")) {
      return false;
    }
    try {
      const realPath = this.resolveAndValidate(this.toRealPath(path), path);
      await fsPromises.access(realPath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FsStat> {
    assertValidPath(path, "stat");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    try {
      const stat = await fsPromises.stat(realPath);
      return {
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: false,
        mode: stat.mode,
        size: stat.size,
        mtime: stat.mtime,
      };
    } catch (error) {
      if (errCode(error) === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      }
      throw error;
    }
  }

  async lstat(path: string): Promise<FsStat> {
    assertValidPath(path, "lstat");
    const realPath = this.validateParent(this.toRealPath(path), path);
    try {
      const stat = await fsPromises.lstat(realPath);
      return {
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: stat.isSymbolicLink(),
        mode: stat.mode,
        size: stat.size,
        mtime: stat.mtime,
      };
    } catch (error) {
      if (errCode(error) === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, lstat '${path}'`);
      }
      throw error;
    }
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    assertValidPath(path, "mkdir");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    try {
      await fsPromises.mkdir(realPath, { recursive: options?.recursive });
    } catch (error) {
      const code = errCode(error);
      if (code === "EEXIST") {
        throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
      }
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
      }
      throw error;
    }
  }

  async readdir(path: string): Promise<string[]> {
    return (await this.readdirWithFileTypes(path)).map((entry) => entry.name);
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    assertValidPath(path, "scandir");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    try {
      const entries = await fsPromises.readdir(realPath, { withFileTypes: true });
      return entries
        .map((entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
          isSymbolicLink: entry.isSymbolicLink(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      }
      if (code === "ENOTDIR") {
        throw new Error(`ENOTDIR: not a directory, scandir '${path}'`);
      }
      throw error;
    }
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    assertValidPath(path, "rm");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    try {
      await fsPromises.rm(realPath, {
        recursive: options?.recursive ?? false,
        force: options?.force ?? false,
      });
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT" && !options?.force) {
        throw new Error(`ENOENT: no such file or directory, rm '${path}'`);
      }
      if (code === "ENOTEMPTY") {
        throw new Error(`ENOTEMPTY: directory not empty, rm '${path}'`);
      }
      throw error;
    }
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    assertValidPath(src, "cp");
    assertValidPath(dest, "cp");
    const srcReal = this.resolveAndValidate(this.toRealPath(src), src);
    const destReal = this.resolveAndValidate(this.toRealPath(dest), dest);
    try {
      await fsPromises.cp(srcReal, destReal, {
        recursive: options?.recursive ?? false,
        filter: async (source) => {
          if (this.allowSymlinks) {
            return true;
          }
          try {
            return !lstatSync(source).isSymbolicLink();
          } catch {
            return false;
          }
        },
      });
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, cp '${src}'`);
      }
      if (code === "EISDIR" || code === "ERR_FS_EISDIR") {
        throw new Error(`EISDIR: is a directory, cp '${src}'`);
      }
      throw error;
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    assertValidPath(src, "mv");
    assertValidPath(dest, "mv");
    const srcReal = this.validateParent(this.toRealPath(src), src);
    const destInput = this.toRealPath(dest);
    const destReal = this.validateParent(destInput, dest);
    await fsPromises.mkdir(pathDirname(destReal), { recursive: true });
    try {
      await fsPromises.rename(srcReal, destReal);
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, mv '${src}'`);
      }
      if (code === "EXDEV") {
        await this.cp(src, dest, { recursive: true });
        await this.rm(src, { recursive: true });
        return;
      }
      throw error;
    }
  }

  resolvePath(base: string, path: string): string {
    if (path.startsWith("/")) {
      return normalizePath(path);
    }
    return normalizePath(base === "/" ? `/${path}` : `${base}/${path}`);
  }

  getAllPaths(): string[] {
    const out: string[] = [];
    this.scanDir("/", out);
    return out.sort();
  }

  private scanDir(path: string, out: string[]): void {
    let realPath: string;
    try {
      realPath = this.resolveAndValidate(this.toRealPath(path), path);
    } catch {
      return;
    }
    let entries: string[];
    try {
      entries = readdirSync(realPath);
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path === "/" ? `/${entry}` : `${path}/${entry}`;
      out.push(child);
      try {
        if (lstatSync(pathJoin(realPath, entry)).isDirectory()) {
          this.scanDir(child, out);
        }
      } catch {
        // Ignore entries that disappear during a scan.
      }
    }
  }

  async chmod(path: string, mode: number): Promise<void> {
    assertValidPath(path, "chmod");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
    try {
      handle = await fsPromises.open(
        realPath,
        this.allowSymlinks ? fsConstants.O_RDONLY : fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      await handle.chmod(mode);
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, chmod '${path}'`);
      }
      if (code === "ELOOP") {
        throw new Error(`EACCES: permission denied, '${path}' is a symlink`);
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    if (!this.allowSymlinks) {
      throw new Error(`EPERM: operation not permitted, symlink '${linkPath}'`);
    }
    assertValidPath(linkPath, "symlink");
    const realPath = this.validateParent(this.toRealPath(linkPath), linkPath);
    const linkDir = pathDirname(realPath);
    const linkVirtualDir = dirname(normalizePath(linkPath));
    const normalizedTarget = target.startsWith("/")
      ? normalizePath(target)
      : normalizePath(joinPath(linkVirtualDir, target));
    const targetReal = this.resolveAndValidate(this.toRealPath(normalizedTarget), target);
    const storedTarget = target.startsWith("/")
      ? targetReal
      : pathRelative(linkDir, targetReal) || ".";
    try {
      await fsPromises.symlink(storedTarget, realPath);
    } catch (error) {
      if (errCode(error) === "EEXIST") {
        throw new Error(`EEXIST: file already exists, symlink '${linkPath}'`);
      }
      throw error;
    }
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    assertValidPath(existingPath, "link");
    assertValidPath(newPath, "link");
    const source = this.resolveAndValidate(this.toRealPath(existingPath), existingPath);
    const target = this.resolveAndValidate(this.toRealPath(newPath), newPath);
    try {
      await fsPromises.link(source, target);
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, link '${existingPath}'`);
      }
      if (code === "EEXIST") {
        throw new Error(`EEXIST: file already exists, link '${newPath}'`);
      }
      if (code === "EPERM") {
        throw new Error(`EPERM: operation not permitted, link '${existingPath}'`);
      }
      throw error;
    }
  }

  async readlink(path: string): Promise<string> {
    assertValidPath(path, "readlink");
    const realPath = this.validateParent(this.toRealPath(path), path);
    try {
      const target = await fsPromises.readlink(realPath);
      if (!pathIsAbsolute(target)) {
        const absolute = pathResolve(pathDirname(realPath), target);
        let canonical = absolute;
        try {
          canonical = realpathSync(absolute);
        } catch {
          // Broken symlinks still return a safe target below.
        }
        if (!isPathWithinRoot(canonical, this.canonicalRoot)) {
          return pathBasename(target);
        }
        const virtualBase = dirname(normalizePath(path));
        const virtualTarget = toVirtualPath(canonical, this.canonicalRoot);
        return pathRelative(virtualBase, virtualTarget).replace(/\\/g, "/") || ".";
      }
      let canonical = target;
      try {
        canonical = realpathSync(target);
      } catch {
        canonical = pathResolve(target);
      }
      return isPathWithinRoot(canonical, this.canonicalRoot)
        ? toVirtualPath(canonical, this.canonicalRoot)
        : pathBasename(target);
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, readlink '${path}'`);
      }
      if (code === "EINVAL") {
        throw new Error(`EINVAL: invalid argument, readlink '${path}'`);
      }
      throw error;
    }
  }

  async realpath(path: string): Promise<string> {
    assertValidPath(path, "realpath");
    try {
      const canonical = realpathSync(this.toRealPath(path));
      if (!isPathWithinRoot(canonical, this.canonicalRoot)) {
        throw new Error(`ENOENT: no such file or directory, realpath '${path}'`);
      }
      return toVirtualPath(canonical, this.canonicalRoot);
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw error;
      }
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, realpath '${path}'`);
      }
      if (code === "ELOOP") {
        throw new Error(`ELOOP: too many levels of symbolic links, realpath '${path}'`);
      }
      throw error;
    }
  }

  async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
    assertValidPath(path, "utimes");
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
    try {
      handle = await fsPromises.open(
        realPath,
        this.allowSymlinks ? fsConstants.O_RDONLY : fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      await handle.utimes(atime, mtime);
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT") {
        throw new Error(`ENOENT: no such file or directory, utimes '${path}'`);
      }
      if (code === "ELOOP") {
        throw new Error(`EACCES: permission denied, '${path}' is a symlink`);
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }
}
