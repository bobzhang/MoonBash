import {
  bytesFromUint8Array,
  latin1FromBytes,
  type ByteString,
  unsafeBytesFromLatin1,
  uint8ArrayFromBytes,
} from "./encoding";
import type { InitialFiles } from "./types";

export type BufferEncoding = "utf8" | "utf-8" | "ascii" | "binary" | "base64" | "hex" | "latin1";
export type FileContent = string | Uint8Array;
export interface ReadFileOptions {
  encoding?: BufferEncoding | null;
}
export interface WriteFileOptions {
  encoding?: BufferEncoding;
}

export interface FileEntry {
  type: "file";
  content: FileContent;
  mode: number;
  mtime: Date;
}

export interface DirectoryEntry {
  type: "directory";
  mode: number;
  mtime: Date;
}

export interface SymlinkEntry {
  type: "symlink";
  target: string;
  mode: number;
  mtime: Date;
}

export interface LazyFileEntry {
  type: "file";
  lazy: () => string | Uint8Array | Promise<string | Uint8Array>;
  mode: number;
  mtime: Date;
}

export type FsEntry = FileEntry | LazyFileEntry | DirectoryEntry | SymlinkEntry;

export interface DirentEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

export interface FsStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  mode: number;
  size: number;
  mtime: Date;
}

export interface MkdirOptions {
  recursive?: boolean;
}

export interface RmOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface CpOptions {
  recursive?: boolean;
}

export interface IFileSystem {
  readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
  readFileBytes?(path: string): Promise<ByteString>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void>;
  appendFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FsStat>;
  mkdir(path: string, options?: MkdirOptions): Promise<void>;
  readdir(path: string): Promise<string[]>;
  rm(path: string, options?: RmOptions): Promise<void>;
  cp(src: string, dest: string, options?: CpOptions): Promise<void>;
  mv(src: string, dest: string): Promise<void>;
  resolvePath(base: string, path: string): string;
  getAllPaths(): string[];
  chmod(path: string, mode: number): Promise<void>;
  symlink(target: string, linkPath: string): Promise<void>;
  link(existingPath: string, newPath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  lstat(path: string): Promise<FsStat>;
  realpath(path: string): Promise<string>;
  utimes(path: string, atime: Date, mtime: Date): Promise<void>;
}

export interface FileInit {
  content?: FileContent | (() => FileContent | Promise<FileContent>);
  mode?: number;
  mtime?: Date;
}

export type LazyFileProvider = () => string | Uint8Array | Promise<string | Uint8Array>;
export type FileSystemFactory = (initialFiles?: InitialFiles) => IFileSystem;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function isFileInit(value: unknown): value is FileInit {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Uint8Array) &&
    "content" in value
  );
}

function assertValidPath(path: string, operation: string): void {
  if (path.includes("\0")) {
    throw new Error(`ENOENT: path contains null byte, ${operation} '${path}'`);
  }
}

function normalizePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }
  const trimmed = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  const absolute = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const parts: string[] = [];
  for (const part of absolute.split("/")) {
    if (!part || part === ".") {
      continue;
    }
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
  if (normalized === "/") {
    return "/";
  }
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

function getEncoding(options?: ReadFileOptions | WriteFileOptions | BufferEncoding): BufferEncoding {
  if (typeof options === "string") {
    return options;
  }
  return options?.encoding ?? "utf8";
}

function encodeFileContent(content: FileContent, encoding: BufferEncoding): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }
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

function contentToBytes(content: FileContent): Uint8Array {
  return content instanceof Uint8Array ? content : textEncoder.encode(content);
}

function asciiFromBytes(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += String.fromCharCode(byte & 0x7f);
  }
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
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function decodeBase64(input: string): Uint8Array {
  if (typeof atob === "function") {
    const raw = atob(input);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  }
  const bufferCtor = (globalThis as { Buffer?: { from(data: string, encoding: "base64"): Uint8Array } }).Buffer;
  if (bufferCtor) {
    return Uint8Array.from(bufferCtor.from(input, "base64"));
  }
  throw new Error("base64 decoding is not available in this runtime");
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let raw = "";
    for (const byte of bytes) {
      raw += String.fromCharCode(byte);
    }
    return btoa(raw);
  }
  const bufferCtor = (globalThis as { Buffer?: { from(data: Uint8Array): { toString(encoding: "base64"): string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString("base64");
  }
  throw new Error("base64 encoding is not available in this runtime");
}

function statFromEntry(entry: FsEntry, isLstatSymlink: boolean): FsStat {
  if (entry.type === "file" && "lazy" in entry) {
    return {
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      mode: entry.mode,
      size: 0,
      mtime: entry.mtime,
    };
  }
  if (entry.type === "file") {
    return {
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      mode: entry.mode,
      size: contentToBytes(entry.content).length,
      mtime: entry.mtime,
    };
  }
  if (entry.type === "directory") {
    return {
      isFile: false,
      isDirectory: true,
      isSymbolicLink: false,
      mode: entry.mode,
      size: 0,
      mtime: entry.mtime,
    };
  }
  return {
    isFile: false,
    isDirectory: false,
    isSymbolicLink: isLstatSymlink,
    mode: entry.mode,
    size: entry.target.length,
    mtime: entry.mtime,
  };
}

function parseMode(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export class InMemoryFs implements IFileSystem {
  private readonly data = new Map<string, FsEntry>();

  constructor(readonly initialFiles?: InitialFiles) {
    this.data.set("/", { type: "directory", mode: 0o755, mtime: new Date() });

    if (!initialFiles || typeof initialFiles !== "object") {
      return;
    }

    for (const [path, value] of Object.entries(initialFiles)) {
      if (typeof value === "function") {
        this.writeFileLazy(path, value as LazyFileProvider);
      } else if (isFileInit(value)) {
        const content = typeof value.content === "function"
          ? ""
          : value.content ?? "";
        this.writeFileSync(path, content, undefined, {
          mode: value.mode,
          mtime: value.mtime,
        });
      } else {
        this.writeFileSync(path, value as FileContent);
      }
    }
  }

  private ensureParentDirs(path: string): void {
    const parent = dirname(path);
    if (parent === "/" || this.data.has(parent)) {
      return;
    }
    this.ensureParentDirs(parent);
    this.data.set(parent, { type: "directory", mode: 0o755, mtime: new Date() });
  }

  writeFileSync(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
    metadata?: { mode?: number; mtime?: Date },
  ): void {
    assertValidPath(path, "write");
    const normalized = normalizePath(path);
    this.ensureParentDirs(normalized);
    this.data.set(normalized, {
      type: "file",
      content: encodeFileContent(content, getEncoding(options)),
      mode: metadata?.mode ?? 0o644,
      mtime: metadata?.mtime ?? new Date(),
    });
  }

  writeFileLazy(
    path: string,
    lazy: LazyFileProvider,
    metadata?: { mode?: number; mtime?: Date },
  ): void {
    assertValidPath(path, "write");
    const normalized = normalizePath(path);
    this.ensureParentDirs(normalized);
    this.data.set(normalized, {
      type: "file",
      lazy,
      mode: metadata?.mode ?? 0o644,
      mtime: metadata?.mtime ?? new Date(),
    });
  }

  private async materializeLazy(path: string, entry: LazyFileEntry): Promise<FileEntry> {
    const raw = await entry.lazy();
    const materialized: FileEntry = {
      type: "file",
      content: typeof raw === "string" ? new TextEncoder().encode(raw) : raw,
      mode: entry.mode,
      mtime: entry.mtime,
    };
    this.data.set(path, materialized);
    return materialized;
  }

  async readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
    return decodeFileContent(await this.readFileBuffer(path), getEncoding(options));
  }

  async readFileBytes(path: string): Promise<ByteString> {
    return bytesFromUint8Array(await this.readFileBuffer(path));
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    assertValidPath(path, "open");
    const resolved = this.resolvePathWithSymlinks(path, "open");
    const entry = this.data.get(resolved);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    if (entry.type !== "file") {
      throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
    }
    const file = "lazy" in entry ? await this.materializeLazy(resolved, entry) : entry;
    return contentToBytes(file.content);
  }

  async writeFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    this.writeFileSync(path, content, options);
  }

  async appendFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    assertValidPath(path, "append");
    const normalized = normalizePath(path);
    const existing = this.data.get(normalized);
    if (existing?.type === "directory") {
      throw new Error(`EISDIR: illegal operation on a directory, write '${path}'`);
    }

    const appended = encodeFileContent(content, getEncoding(options));
    if (existing?.type === "file") {
      const file = "lazy" in existing ? await this.materializeLazy(normalized, existing) : existing;
      const previous = contentToBytes(file.content);
      const next = new Uint8Array(previous.length + appended.length);
      next.set(previous);
      next.set(appended, previous.length);
      this.data.set(normalized, {
        type: "file",
        content: next,
        mode: file.mode,
        mtime: new Date(),
      });
      return;
    }

    this.writeFileSync(path, content, options);
  }

  async exists(path: string): Promise<boolean> {
    if (path.includes("\0")) {
      return false;
    }
    try {
      return this.data.has(this.resolvePathWithSymlinks(path, "open"));
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FsStat> {
    assertValidPath(path, "stat");
    const resolved = this.resolvePathWithSymlinks(path, "stat");
    let entry = this.data.get(resolved);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    if (entry.type === "file" && "lazy" in entry) {
      entry = await this.materializeLazy(resolved, entry);
    }
    return statFromEntry(entry, false);
  }

  async lstat(path: string): Promise<FsStat> {
    assertValidPath(path, "lstat");
    const resolved = this.resolveIntermediateSymlinks(path, "lstat");
    let entry = this.data.get(resolved);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, lstat '${path}'`);
    }
    if (entry.type === "file" && "lazy" in entry) {
      entry = await this.materializeLazy(resolved, entry);
    }
    return statFromEntry(entry, entry.type === "symlink");
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    this.mkdirSync(path, options);
  }

  mkdirSync(path: string, options?: MkdirOptions): void {
    assertValidPath(path, "mkdir");
    const normalized = normalizePath(path);
    const existing = this.data.get(normalized);
    if (existing) {
      if (existing.type === "file") {
        throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
      }
      if (!options?.recursive) {
        throw new Error(`EEXIST: directory already exists, mkdir '${path}'`);
      }
      return;
    }

    const parent = dirname(normalized);
    if (parent !== "/" && !this.data.has(parent)) {
      if (options?.recursive) {
        this.mkdirSync(parent, { recursive: true });
      } else {
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
      }
    }
    this.data.set(normalized, { type: "directory", mode: 0o755, mtime: new Date() });
  }

  async readdir(path: string): Promise<string[]> {
    return (await this.readdirWithFileTypes(path)).map((entry) => entry.name);
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    assertValidPath(path, "scandir");
    let normalized = normalizePath(path);
    let entry = this.data.get(normalized);
    const seen = new Set<string>();
    while (entry?.type === "symlink") {
      if (seen.has(normalized)) {
        throw new Error(`ELOOP: too many levels of symbolic links, scandir '${path}'`);
      }
      seen.add(normalized);
      normalized = resolveLinkTarget(normalized, entry.target);
      entry = this.data.get(normalized);
    }
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }
    if (entry.type !== "directory") {
      throw new Error(`ENOTDIR: not a directory, scandir '${path}'`);
    }

    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const entries = new Map<string, DirentEntry>();
    for (const [candidatePath, candidateEntry] of this.data.entries()) {
      if (candidatePath === normalized || !candidatePath.startsWith(prefix)) {
        continue;
      }
      const rest = candidatePath.slice(prefix.length);
      const firstSlash = rest.indexOf("/");
      const name = firstSlash === -1 ? rest : rest.slice(0, firstSlash);
      if (!name || entries.has(name)) {
        continue;
      }
      const childPath = normalized === "/" ? `/${name}` : `${normalized}/${name}`;
      const childEntry = firstSlash === -1
        ? candidateEntry
        : this.data.get(childPath) ?? { type: "directory", mode: 0o755, mtime: new Date() };
      entries.set(name, {
        name,
        isFile: childEntry.type === "file",
        isDirectory: childEntry.type === "directory",
        isSymbolicLink: childEntry.type === "symlink",
      });
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    assertValidPath(path, "rm");
    const normalized = normalizePath(path);
    const entry = this.data.get(normalized);
    if (!entry) {
      if (options?.force) {
        return;
      }
      throw new Error(`ENOENT: no such file or directory, rm '${path}'`);
    }
    if (entry.type === "directory") {
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
    if (normalized !== "/") {
      this.data.delete(normalized);
    }
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    assertValidPath(src, "cp");
    assertValidPath(dest, "cp");
    const source = normalizePath(src);
    const destination = normalizePath(dest);
    const entry = this.data.get(source);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, cp '${src}'`);
    }

    if (entry.type === "directory") {
      if (!options?.recursive) {
        throw new Error(`EISDIR: is a directory, cp '${src}'`);
      }
      await this.mkdir(destination, { recursive: true });
      for (const child of await this.readdir(source)) {
        await this.cp(joinPath(source, child), joinPath(destination, child), options);
      }
      return;
    }

    this.ensureParentDirs(destination);
    if (entry.type === "symlink") {
      this.data.set(destination, { ...entry });
      return;
    }

    const file = "lazy" in entry ? await this.materializeLazy(source, entry) : entry;
    this.data.set(destination, {
      ...file,
      content: file.content instanceof Uint8Array ? new Uint8Array(file.content) : file.content,
    });
  }

  async mv(src: string, dest: string): Promise<void> {
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
    return [...this.data.keys()];
  }

  async chmod(path: string, mode: number): Promise<void> {
    assertValidPath(path, "chmod");
    const normalized = normalizePath(path);
    const entry = this.data.get(normalized);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, chmod '${path}'`);
    }
    entry.mode = mode;
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    assertValidPath(linkPath, "symlink");
    const normalized = normalizePath(linkPath);
    if (this.data.has(normalized)) {
      throw new Error(`EEXIST: file already exists, symlink '${linkPath}'`);
    }
    this.ensureParentDirs(normalized);
    this.data.set(normalized, {
      type: "symlink",
      target,
      mode: 0o777,
      mtime: new Date(),
    });
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    assertValidPath(existingPath, "link");
    assertValidPath(newPath, "link");
    const source = normalizePath(existingPath);
    const destination = normalizePath(newPath);
    const entry = this.data.get(source);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, link '${existingPath}'`);
    }
    if (entry.type !== "file") {
      throw new Error(`EPERM: operation not permitted, link '${existingPath}'`);
    }
    if (this.data.has(destination)) {
      throw new Error(`EEXIST: file already exists, link '${newPath}'`);
    }
    const file = "lazy" in entry ? await this.materializeLazy(source, entry) : entry;
    this.ensureParentDirs(destination);
    this.data.set(destination, {
      type: "file",
      content: file.content,
      mode: file.mode,
      mtime: file.mtime,
    });
  }

  async readlink(path: string): Promise<string> {
    assertValidPath(path, "readlink");
    const normalized = normalizePath(path);
    const entry = this.data.get(normalized);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, readlink '${path}'`);
    }
    if (entry.type !== "symlink") {
      throw new Error(`EINVAL: invalid argument, readlink '${path}'`);
    }
    return entry.target;
  }

  async realpath(path: string): Promise<string> {
    assertValidPath(path, "realpath");
    const resolved = this.resolvePathWithSymlinks(path, "realpath");
    if (!this.data.has(resolved)) {
      throw new Error(`ENOENT: no such file or directory, realpath '${path}'`);
    }
    return resolved;
  }

  async utimes(path: string, _atime: Date, mtime: Date): Promise<void> {
    assertValidPath(path, "utimes");
    const resolved = this.resolvePathWithSymlinks(path, "utimes");
    const entry = this.data.get(resolved);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, utimes '${path}'`);
    }
    entry.mtime = mtime;
  }

  __moon_bash_snapshot(): Record<string, FileInit> {
    const snapshot: Record<string, FileInit> = {};
    for (const [path, entry] of this.data.entries()) {
      if (entry.type !== "file" || "lazy" in entry) {
        continue;
      }
      snapshot[path] = {
        content: entry.content,
        mode: entry.mode,
        mtime: entry.mtime,
      };
    }
    return snapshot;
  }

  __moon_bash_apply_state(
    files: Record<string, string>,
    dirs?: Record<string, string>,
    links?: Record<string, string>,
    modes?: Record<string, string>,
  ): void {
    this.data.clear();
    this.data.set("/", { type: "directory", mode: 0o755, mtime: new Date() });

    for (const dirPath of Object.keys(dirs ?? {})) {
      const normalized = normalizePath(dirPath);
      if (normalized !== "/") {
        this.data.set(normalized, {
          type: "directory",
          mode: parseMode(modes?.[normalized], 0o755),
          mtime: new Date(),
        });
      }
    }

    for (const [path, target] of Object.entries(links ?? {})) {
      const normalized = normalizePath(path);
      this.ensureParentDirs(normalized);
      this.data.set(normalized, {
        type: "symlink",
        target,
        mode: parseMode(modes?.[normalized], 0o777),
        mtime: new Date(),
      });
    }

    for (const [path, content] of Object.entries(files)) {
      const normalized = normalizePath(path);
      this.ensureParentDirs(normalized);
      this.data.set(normalized, {
        type: "file",
        content,
        mode: parseMode(modes?.[normalized], 0o644),
        mtime: new Date(),
      });
    }
  }

  private resolveIntermediateSymlinks(path: string, operation: string): string {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return "/";
    }
    const parts = normalized.slice(1).split("/");
    if (parts.length <= 1) {
      return normalized;
    }

    let current = "";
    const seen = new Set<string>();
    for (let i = 0; i < parts.length - 1; i += 1) {
      current = `${current}/${parts[i]}`;
      let entry = this.data.get(current);
      let depth = 0;
      while (entry?.type === "symlink" && depth < 40) {
        if (seen.has(current)) {
          throw new Error(`ELOOP: too many levels of symbolic links, ${operation} '${path}'`);
        }
        seen.add(current);
        current = resolveLinkTarget(current, entry.target);
        entry = this.data.get(current);
        depth += 1;
      }
      if (depth >= 40) {
        throw new Error(`ELOOP: too many levels of symbolic links, ${operation} '${path}'`);
      }
    }
    return `${current}/${parts[parts.length - 1]}`;
  }

  private resolvePathWithSymlinks(path: string, operation: string): string {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return "/";
    }

    const parts = normalized.slice(1).split("/");
    let current = "";
    const seen = new Set<string>();
    for (const part of parts) {
      current = `${current}/${part}`;
      let entry = this.data.get(current);
      let depth = 0;
      while (entry?.type === "symlink" && depth < 40) {
        if (seen.has(current)) {
          throw new Error(`ELOOP: too many levels of symbolic links, ${operation} '${path}'`);
        }
        seen.add(current);
        current = resolveLinkTarget(current, entry.target);
        entry = this.data.get(current);
        depth += 1;
      }
      if (depth >= 40) {
        throw new Error(`ELOOP: too many levels of symbolic links, ${operation} '${path}'`);
      }
    }
    return current;
  }
}

export interface MountConfig {
  mountPoint: string;
  filesystem: IFileSystem;
}

export interface MountableFsOptions {
  base: IFileSystem;
  mounts?: MountConfig[];
}

export class MountableFs extends InMemoryFs {
  constructor(readonly options: MountableFsOptions) {
    super();
  }
}

export interface OverlayFsOptions {
  root: string;
  readOnly?: boolean;
}

export class OverlayFs extends InMemoryFs {
  constructor(readonly options: OverlayFsOptions) {
    super();
  }
}

export interface ReadWriteFsOptions {
  root: string;
}

export class ReadWriteFs extends InMemoryFs {
  constructor(readonly options: ReadWriteFsOptions) {
    super();
  }
}
