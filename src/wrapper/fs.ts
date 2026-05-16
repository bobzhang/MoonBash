import type { InitialFiles } from "./types";

export type BufferEncoding = "utf8" | "utf-8" | "ascii" | "binary" | "base64" | "hex" | "latin1";
export type FileContent = string | Uint8Array;

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
  readFile(path: string, options?: BufferEncoding | { encoding?: BufferEncoding | null }): Promise<string>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: FileContent, options?: BufferEncoding | { encoding?: BufferEncoding }): Promise<void>;
  appendFile(path: string, content: FileContent, options?: BufferEncoding | { encoding?: BufferEncoding }): Promise<void>;
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
}

export interface FileInit {
  content?: FileContent | (() => FileContent | Promise<FileContent>);
  mode?: number;
}

export type LazyFileProvider = () => string | Uint8Array | Promise<string | Uint8Array>;
export type FileSystemFactory = (initialFiles?: InitialFiles) => IFileSystem;

export class InMemoryFs implements IFileSystem {
  constructor(readonly initialFiles?: InitialFiles) {}

  private notImplemented(): never {
    throw new Error("moon-bash: InMemoryFs public class is not implemented yet");
  }

  readFile(): Promise<string> { return Promise.resolve(this.notImplemented()); }
  readFileBuffer(): Promise<Uint8Array> { return Promise.resolve(this.notImplemented()); }
  writeFile(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  appendFile(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  exists(): Promise<boolean> { return Promise.resolve(this.notImplemented()); }
  stat(): Promise<FsStat> { return Promise.resolve(this.notImplemented()); }
  mkdir(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  readdir(): Promise<string[]> { return Promise.resolve(this.notImplemented()); }
  rm(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  cp(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  mv(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  resolvePath(_base: string, path: string): string { return path; }
  getAllPaths(): string[] { return []; }
  chmod(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  symlink(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  link(): Promise<void> { return Promise.resolve(this.notImplemented()); }
  readlink(): Promise<string> { return Promise.resolve(this.notImplemented()); }
  lstat(): Promise<FsStat> { return Promise.resolve(this.notImplemented()); }
  realpath(path: string): Promise<string> { return Promise.resolve(path); }
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
