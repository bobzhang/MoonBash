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
  type ByteString,
} from "./encoding";
import {
  InMemoryFs,
  type BufferEncoding,
  type CpOptions,
  type DirentEntry,
  type FileContent,
  type FsStat,
  type IFileSystem,
  type MkdirOptions,
  type ReadFileOptions,
  type RmOptions,
  type WriteFileOptions,
} from "./fs";

const DEFAULT_MOUNT_POINT = "/home/user/project";

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

function resolveLinkTarget(linkPath: string, target: string): string {
  if (target.startsWith("/")) {
    return normalizePath(target);
  }
  return normalizePath(joinPath(dirname(linkPath), target));
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

function toVirtualPath(realPath: string, canonicalRoot: string, mountPoint: string): string {
  const relative = pathRelative(canonicalRoot, realPath).replace(/\\/g, "/");
  const rootRelative = relative ? `/${relative}` : "/";
  if (mountPoint === "/") {
    return rootRelative;
  }
  return rootRelative === "/" ? mountPoint : `${mountPoint}${rootRelative}`;
}

function errCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function isMissing(error: unknown): boolean {
  return errCode(error) === "ENOENT" ||
    (error instanceof Error && error.message.includes("ENOENT"));
}

export interface OverlayFsOptions {
  root: string;
  mountPoint?: string;
  readOnly?: boolean;
  maxFileReadSize?: number;
  allowSymlinks?: boolean;
}

export class OverlayFs implements IFileSystem {
  private readonly root: string;
  private readonly canonicalRoot: string;
  private readonly mountPoint: string;
  private readonly readOnly: boolean;
  private readonly maxFileReadSize: number;
  private readonly allowSymlinks: boolean;
  private readonly memory = new InMemoryFs();
  private readonly deleted = new Set<string>();

  constructor(readonly options: OverlayFsOptions) {
    this.root = pathResolve(options.root);
    if (!existsSync(this.root)) {
      throw new Error("OverlayFs root does not exist");
    }
    if (!statSync(this.root).isDirectory()) {
      throw new Error("OverlayFs root is not a directory");
    }
    const mountPoint = options.mountPoint ?? DEFAULT_MOUNT_POINT;
    if (!mountPoint.startsWith("/")) {
      throw new Error(`Mount point must be an absolute path: ${mountPoint}`);
    }
    this.mountPoint = mountPoint === "/" ? "/" : normalizePath(mountPoint);
    this.canonicalRoot = realpathSync(this.root);
    this.readOnly = options.readOnly ?? false;
    this.maxFileReadSize = options.maxFileReadSize ?? 10 * 1024 * 1024;
    this.allowSymlinks = options.allowSymlinks ?? false;
    this.createMountPointDirs();
  }

  private createMountPointDirs(): void {
    if (this.mountPoint !== "/") {
      this.memory.mkdirSync(this.mountPoint, { recursive: true });
    }
  }

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new Error(`EROFS: read-only file system, ${operation}`);
    }
  }

  getMountPoint(): string {
    return this.mountPoint;
  }

  mkdirSync(path: string, options?: MkdirOptions): void {
    this.memory.mkdirSync(path, options);
    this.deleted.delete(normalizePath(path));
  }

  writeFileSync(path: string, content: FileContent): void {
    this.memory.writeFileSync(path, content);
    this.deleted.delete(normalizePath(path));
  }

  private getRelativeToMount(path: string): string | null {
    const normalized = normalizePath(path);
    if (this.mountPoint === "/") {
      return normalized;
    }
    if (normalized === this.mountPoint) {
      return "/";
    }
    if (normalized.startsWith(`${this.mountPoint}/`)) {
      return normalized.slice(this.mountPoint.length);
    }
    return null;
  }

  private toRealPath(path: string): string | null {
    const relative = this.getRelativeToMount(path);
    if (relative === null) {
      return null;
    }
    const candidate = relative === "/"
      ? this.root
      : pathResolve(this.root, `.${relative}`);
    return isPathWithinRoot(candidate, this.root) ? candidate : null;
  }

  private resolveAndValidate(realPath: string | null, virtualPath: string): string | null {
    if (!realPath) {
      return null;
    }
    const nearest = nearestExistingParent(realPath);
    if (!nearest) {
      return null;
    }

    let canonicalNearest: string;
    try {
      canonicalNearest = realpathSync(nearest);
    } catch {
      return null;
    }
    if (!isPathWithinRoot(canonicalNearest, this.canonicalRoot)) {
      return null;
    }

    if (!this.allowSymlinks) {
      const unresolvedRelative = pathRelative(this.root, pathResolve(realPath)).replace(/\\/g, "/");
      const resolvedCandidate = nearest === realPath
        ? canonicalNearest
        : pathJoin(canonicalNearest, pathRelative(nearest, realPath));
      const resolvedRelative = pathRelative(this.canonicalRoot, resolvedCandidate).replace(/\\/g, "/");
      if (unresolvedRelative !== resolvedRelative) {
        return null;
      }
      try {
        if (lstatSync(realPath).isSymbolicLink()) {
          return null;
        }
      } catch (error) {
        if (errCode(error) !== "ENOENT") {
          throw new Error(`EACCES: permission denied, '${virtualPath}' resolves outside sandbox`);
        }
      }
    }

    const resolved = nearest === realPath
      ? canonicalNearest
      : pathJoin(canonicalNearest, pathRelative(nearest, realPath));
    const absoluteResolved = pathResolve(resolved);
    return isPathWithinRoot(absoluteResolved, this.canonicalRoot)
      ? absoluteResolved
      : null;
  }

  private validateParent(realPath: string | null): string | null {
    if (!realPath) {
      return null;
    }
    const parent = this.resolveAndValidate(pathDirname(realPath), realPath);
    return parent ? pathJoin(parent, pathBasename(realPath)) : null;
  }

  private realTargetToVirtual(linkPath: string, target: string): string {
    if (!pathIsAbsolute(target)) {
      return target;
    }
    let canonical = target;
    try {
      canonical = realpathSync(target);
    } catch {
      canonical = pathResolve(target);
    }
    return isPathWithinRoot(canonical, this.canonicalRoot)
      ? toVirtualPath(canonical, this.canonicalRoot, this.mountPoint)
      : pathBasename(target);
  }

  private async memoryLstat(path: string): Promise<FsStat | undefined> {
    try {
      return await this.memory.lstat(path);
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async memoryExists(path: string): Promise<boolean> {
    return (await this.memoryLstat(path)) !== undefined;
  }

  private async existsOnRealFs(path: string): Promise<boolean> {
    const realPath = this.validateParent(this.toRealPath(path));
    if (!realPath) {
      return false;
    }
    try {
      await fsPromises.lstat(realPath);
      return true;
    } catch {
      return false;
    }
  }

  private async existsInOverlay(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    if (this.deleted.has(normalized)) {
      return false;
    }
    if (await this.memoryExists(normalized)) {
      return true;
    }
    return this.existsOnRealFs(normalized);
  }

  async readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
    return new InMemoryFs({ "/tmp": await this.readFileBuffer(path) }).readFile("/tmp", options);
  }

  async readFileBytes(path: string): Promise<ByteString> {
    return bytesFromUint8Array(await this.readFileBuffer(path));
  }

  async readFileBuffer(path: string, seen: Set<string> = new Set()): Promise<Uint8Array> {
    assertValidPath(path, "open");
    const normalized = normalizePath(path);
    if (seen.has(normalized)) {
      throw new Error(`ELOOP: too many levels of symbolic links, open '${path}'`);
    }
    seen.add(normalized);
    if (this.deleted.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }

    const memoryStat = await this.memoryLstat(normalized);
    if (memoryStat) {
      if (memoryStat.isSymbolicLink) {
        return this.readFileBuffer(resolveLinkTarget(normalized, await this.memory.readlink(normalized)), seen);
      }
      return this.memory.readFileBuffer(normalized);
    }

    const realPath = this.resolveAndValidate(this.toRealPath(normalized), path);
    if (!realPath) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
    try {
      const stat = await fsPromises.lstat(realPath);
      if (stat.isSymbolicLink()) {
        if (!this.allowSymlinks) {
          throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        }
      }
      if (stat.isDirectory()) {
        throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
      }
      if (this.maxFileReadSize > 0 && stat.size > this.maxFileReadSize) {
        throw new Error(`EFBIG: file too large, read '${path}' (${stat.size} bytes, max ${this.maxFileReadSize})`);
      }
      handle = await fsPromises.open(
        realPath,
        this.allowSymlinks ? fsConstants.O_RDONLY : fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      return new Uint8Array(await handle.readFile());
    } catch (error) {
      const code = errCode(error);
      if (code === "ENOENT" || code === "ELOOP") {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      if (code === "EISDIR" || (error instanceof Error && error.message.includes("EISDIR"))) {
        throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
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
    this.assertWritable(`write '${path}'`);
    await this.memory.writeFile(path, content, options);
    this.deleted.delete(normalizePath(path));
  }

  async appendFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    assertValidPath(path, "append");
    this.assertWritable(`append '${path}'`);
    const normalized = normalizePath(path);
    let previous: FileContent = new Uint8Array();
    try {
      previous = await this.readFileBuffer(normalized);
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }
    await this.memory.writeFile(normalized, previous);
    await this.memory.appendFile(normalized, content, options);
    this.deleted.delete(normalized);
  }

  async exists(path: string): Promise<boolean> {
    if (path.includes("\0")) {
      return false;
    }
    return this.existsInOverlay(path);
  }

  async stat(path: string, seen: Set<string> = new Set()): Promise<FsStat> {
    assertValidPath(path, "stat");
    const normalized = normalizePath(path);
    if (seen.has(normalized)) {
      throw new Error(`ELOOP: too many levels of symbolic links, stat '${path}'`);
    }
    seen.add(normalized);
    if (this.deleted.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }

    const memoryStat = await this.memoryLstat(normalized);
    if (memoryStat) {
      if (memoryStat.isSymbolicLink) {
        return this.stat(resolveLinkTarget(normalized, await this.memory.readlink(normalized)), seen);
      }
      return this.memory.stat(normalized);
    }

    const realPath = this.resolveAndValidate(this.toRealPath(normalized), path);
    if (!realPath) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
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
      if (errCode(error) === "ENOENT" || errCode(error) === "ELOOP") {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      }
      throw error;
    }
  }

  async lstat(path: string): Promise<FsStat> {
    assertValidPath(path, "lstat");
    const normalized = normalizePath(path);
    if (this.deleted.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, lstat '${path}'`);
    }
    const memoryStat = await this.memoryLstat(normalized);
    if (memoryStat) {
      return memoryStat;
    }
    const realPath = this.validateParent(this.toRealPath(normalized));
    if (!realPath) {
      throw new Error(`ENOENT: no such file or directory, lstat '${path}'`);
    }
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
    this.assertWritable(`mkdir '${path}'`);
    const normalized = normalizePath(path);
    if (await this.existsInOverlay(normalized)) {
      if (!options?.recursive) {
        throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
      }
      return;
    }
    const parent = dirname(normalized);
    if (parent !== "/" && !(await this.existsInOverlay(parent))) {
      if (options?.recursive) {
        await this.mkdir(parent, { recursive: true });
      } else {
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
      }
    }
    await this.memory.mkdir(normalized, { recursive: true });
    this.deleted.delete(normalized);
  }

  async readdir(path: string): Promise<string[]> {
    return (await this.readdirWithFileTypes(path)).map((entry) => entry.name);
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    assertValidPath(path, "scandir");
    const normalized = normalizePath(path);
    if (this.deleted.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }

    const entries = new Map<string, DirentEntry>();
    const hidden = new Set<string>();
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    for (const deleted of this.deleted) {
      if (deleted.startsWith(prefix)) {
        const rest = deleted.slice(prefix.length);
        const name = rest.split("/")[0];
        if (name) {
          hidden.add(name);
        }
      }
    }

    const memoryStat = await this.memoryLstat(normalized);
    if (memoryStat?.isFile) {
      throw new Error(`ENOTDIR: not a directory, scandir '${path}'`);
    }
    if (memoryStat?.isSymbolicLink) {
      const target = resolveLinkTarget(normalized, await this.memory.readlink(normalized));
      return this.readdirWithFileTypes(target);
    }
    if (memoryStat?.isDirectory) {
      for (const entry of await this.memory.readdirWithFileTypes(normalized)) {
        if (!hidden.has(entry.name)) {
          entries.set(entry.name, entry);
        }
      }
    }

    const realPath = this.resolveAndValidate(this.toRealPath(normalized), path);
    if (realPath) {
      try {
        const stat = await fsPromises.lstat(realPath);
        if (stat.isFile()) {
          throw new Error(`ENOTDIR: not a directory, scandir '${path}'`);
        }
        if (!stat.isSymbolicLink()) {
          for (const entry of await fsPromises.readdir(realPath, { withFileTypes: true })) {
            if (!hidden.has(entry.name) && !entries.has(entry.name)) {
              entries.set(entry.name, {
                name: entry.name,
                isFile: entry.isFile(),
                isDirectory: entry.isDirectory(),
                isSymbolicLink: entry.isSymbolicLink(),
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("ENOTDIR")) {
          throw error;
        }
        if (errCode(error) !== "ENOENT" && errCode(error) !== "ENOTDIR") {
          throw error;
        }
      }
    }

    if (entries.size === 0 && !memoryStat && this.getRelativeToMount(normalized) !== null && !realPath) {
      return [];
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    assertValidPath(path, "rm");
    this.assertWritable(`rm '${path}'`);
    const normalized = normalizePath(path);
    if (!(await this.existsInOverlay(normalized))) {
      if (options?.force) {
        return;
      }
      throw new Error(`ENOENT: no such file or directory, rm '${path}'`);
    }

    const stat = await this.lstat(normalized);
    if (stat.isDirectory) {
      const children = await this.readdir(normalized);
      if (children.length > 0) {
        if (!options?.recursive) {
          throw new Error(`ENOTEMPTY: directory not empty, rm '${path}'`);
        }
        for (const child of children) {
          await this.rm(joinPath(normalized, child), options);
        }
      }
    }

    try {
      await this.memory.rm(normalized, { recursive: true, force: true });
    } catch {
      // The memory layer is best-effort here; tombstones hide real entries.
    }
    if (await this.existsOnRealFs(normalized)) {
      this.deleted.add(normalized);
    }
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    assertValidPath(src, "cp");
    assertValidPath(dest, "cp");
    this.assertWritable(`cp '${dest}'`);
    const source = normalizePath(src);
    const destination = normalizePath(dest);
    if (!(await this.existsInOverlay(source))) {
      throw new Error(`ENOENT: no such file or directory, cp '${src}'`);
    }
    const stat = await this.lstat(source);
    if (stat.isSymbolicLink) {
      await this.symlink(await this.readlink(source), destination);
      return;
    }
    if (stat.isFile) {
      await this.writeFile(destination, await this.readFileBuffer(source));
      await this.chmod(destination, stat.mode);
      return;
    }
    if (stat.isDirectory) {
      if (!options?.recursive) {
        throw new Error(`EISDIR: is a directory, cp '${src}'`);
      }
      await this.mkdir(destination, { recursive: true });
      for (const child of await this.readdir(source)) {
        await this.cp(joinPath(source, child), joinPath(destination, child), options);
      }
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    this.assertWritable(`mv '${dest}'`);
    await this.cp(src, dest, { recursive: true });
    await this.rm(src, { recursive: true });
  }

  resolvePath(base: string, path: string): string {
    if (path.startsWith("/")) {
      return normalizePath(path);
    }
    return normalizePath(base === "/" ? `/${path}` : `${base}/${path}`);
  }

  getAllPaths(): string[] {
    const paths = new Set<string>();
    for (const path of this.memory.getAllPaths()) {
      if (!this.deleted.has(path)) {
        paths.add(path);
      }
    }
    this.scanRealFs(this.mountPoint, paths);
    return [...paths].sort();
  }

  private scanRealFs(path: string, paths: Set<string>): void {
    if (this.deleted.has(path)) {
      return;
    }
    const realPath = this.resolveAndValidate(this.toRealPath(path), path);
    if (!realPath) {
      return;
    }
    let entries: string[];
    try {
      entries = readdirSync(realPath);
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = joinPath(path, entry);
      if (this.deleted.has(child)) {
        continue;
      }
      paths.add(child);
      try {
        if (lstatSync(pathJoin(realPath, entry)).isDirectory()) {
          this.scanRealFs(child, paths);
        }
      } catch {
        // Ignore entries that disappear during a scan.
      }
    }
  }

  async chmod(path: string, mode: number): Promise<void> {
    assertValidPath(path, "chmod");
    this.assertWritable(`chmod '${path}'`);
    const normalized = normalizePath(path);
    if (!(await this.existsInOverlay(normalized))) {
      throw new Error(`ENOENT: no such file or directory, chmod '${path}'`);
    }
    if (!(await this.memoryExists(normalized))) {
      const stat = await this.stat(normalized);
      if (stat.isDirectory) {
        await this.memory.mkdir(normalized, { recursive: true });
      } else {
        await this.memory.writeFile(normalized, await this.readFileBuffer(normalized));
      }
    }
    await this.memory.chmod(normalized, mode);
    this.deleted.delete(normalized);
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    if (!this.allowSymlinks) {
      throw new Error(`EPERM: operation not permitted, symlink '${linkPath}'`);
    }
    assertValidPath(linkPath, "symlink");
    this.assertWritable(`symlink '${linkPath}'`);
    const normalized = normalizePath(linkPath);
    if (await this.existsInOverlay(normalized)) {
      throw new Error(`EEXIST: file already exists, symlink '${linkPath}'`);
    }
    await this.memory.symlink(target, normalized);
    this.deleted.delete(normalized);
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    assertValidPath(existingPath, "link");
    assertValidPath(newPath, "link");
    this.assertWritable(`link '${newPath}'`);
    const source = normalizePath(existingPath);
    const target = normalizePath(newPath);
    if (!(await this.existsInOverlay(source))) {
      throw new Error(`ENOENT: no such file or directory, link '${existingPath}'`);
    }
    if (await this.existsInOverlay(target)) {
      throw new Error(`EEXIST: file already exists, link '${newPath}'`);
    }
    const stat = await this.stat(source);
    if (!stat.isFile) {
      throw new Error(`EPERM: operation not permitted, link '${existingPath}'`);
    }
    await this.writeFile(target, await this.readFileBuffer(source));
    await this.chmod(target, stat.mode);
  }

  async readlink(path: string): Promise<string> {
    assertValidPath(path, "readlink");
    const normalized = normalizePath(path);
    if (this.deleted.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, readlink '${path}'`);
    }
    const memoryStat = await this.memoryLstat(normalized);
    if (memoryStat) {
      return this.memory.readlink(normalized);
    }
    const realPath = this.validateParent(this.toRealPath(normalized));
    if (!realPath) {
      throw new Error(`ENOENT: no such file or directory, readlink '${path}'`);
    }
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
      }
      return this.realTargetToVirtual(normalized, target);
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
    return this.realpathInner(normalizePath(path), new Set(), path);
  }

  private async realpathInner(path: string, seen: Set<string>, originalPath: string): Promise<string> {
    const normalized = normalizePath(path);
    if (seen.has(normalized)) {
      throw new Error(`ELOOP: too many levels of symbolic links, realpath '${originalPath}'`);
    }
    seen.add(normalized);
    if (this.deleted.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, realpath '${originalPath}'`);
    }

    const memoryStat = await this.memoryLstat(normalized);
    if (memoryStat) {
      if (memoryStat.isSymbolicLink) {
        return this.realpathInner(
          resolveLinkTarget(normalized, await this.memory.readlink(normalized)),
          seen,
          originalPath,
        );
      }
      return normalized;
    }

    const inspectPath = this.validateParent(this.toRealPath(normalized));
    if (inspectPath) {
      try {
        const stat = await fsPromises.lstat(inspectPath);
        if (stat.isSymbolicLink()) {
          if (!this.allowSymlinks) {
            throw new Error(`ENOENT: no such file or directory, realpath '${originalPath}'`);
          }
          const target = await fsPromises.readlink(inspectPath);
          return this.realpathInner(
            resolveLinkTarget(normalized, this.realTargetToVirtual(normalized, target)),
            seen,
            originalPath,
          );
        }
      } catch (error) {
        if (errCode(error) === "ELOOP") {
          throw new Error(`ENOENT: no such file or directory, realpath '${originalPath}'`);
        }
        if (errCode(error) !== "ENOENT") {
          throw error;
        }
      }
    }

    const realPath = this.resolveAndValidate(this.toRealPath(normalized), originalPath);
    if (!realPath) {
      throw new Error(`ENOENT: no such file or directory, realpath '${originalPath}'`);
    }
    try {
      const stat = await fsPromises.lstat(realPath);
      if (stat.isSymbolicLink()) {
        if (!this.allowSymlinks) {
          throw new Error(`ENOENT: no such file or directory, realpath '${originalPath}'`);
        }
        const target = await fsPromises.readlink(realPath);
        return this.realpathInner(
          resolveLinkTarget(normalized, this.realTargetToVirtual(normalized, target)),
          seen,
          originalPath,
        );
      }
      return normalized;
    } catch (error) {
      if (errCode(error) === "ENOENT" || errCode(error) === "ELOOP") {
        throw new Error(`ENOENT: no such file or directory, realpath '${originalPath}'`);
      }
      throw error;
    }
  }

  async utimes(path: string, _atime: Date, mtime: Date): Promise<void> {
    assertValidPath(path, "utimes");
    this.assertWritable(`utimes '${path}'`);
    const normalized = normalizePath(path);
    if (!(await this.existsInOverlay(normalized))) {
      throw new Error(`ENOENT: no such file or directory, utimes '${path}'`);
    }
    if (!(await this.memoryExists(normalized))) {
      const stat = await this.stat(normalized);
      if (stat.isDirectory) {
        await this.memory.mkdir(normalized, { recursive: true });
      } else {
        await this.memory.writeFile(normalized, await this.readFileBuffer(normalized));
      }
      await this.memory.chmod(normalized, stat.mode);
    }
    await this.memory.utimes(normalized, new Date(), mtime);
    this.deleted.delete(normalized);
  }
}
