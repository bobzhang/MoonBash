export type {
  BashExecResult,
  BashLogger,
  BashOptions,
  Command,
  CommandContext,
  CustomCommand,
  ExecOptions,
  ExecResult,
  FileSystem,
  InitialFileEntry,
  InitialFileValue,
  InitialFiles,
} from "./types";

export {
  Bash,
  createLazyCustomCommand,
  defineCommand,
  exec,
  isLazyCommand,
} from "./core";

export type {
  BufferEncoding,
  CpOptions,
  DirectoryEntry,
  FileContent,
  FileEntry,
  FileInit,
  FileSystemFactory,
  FsEntry,
  FsStat,
  IFileSystem,
  LazyFileEntry,
  LazyFileProvider,
  MkdirOptions,
  RmOptions,
  SymlinkEntry,
} from "./fs";
export {
  InMemoryFs,
  MountableFs,
} from "./fs";
export type {
  NetworkConfig,
} from "./network";
export {
  NetworkAccessDeniedError,
  RedirectNotAllowedError,
  TooManyRedirectsError,
} from "./network";

export type {
  AllCommandName,
  CommandName,
  NetworkCommandName,
} from "./commands/registry";
export {
  getCommandNames,
  getNetworkCommandNames,
} from "./commands/registry";
export type { ByteString, OutputKind } from "./encoding";
export {
  bytesOutput,
  decodeBytesToUtf8,
  EMPTY_BYTES,
  encodeUtf8ToBytes,
  latin1FromBytes,
  stdoutAsBytes,
  stdoutKind,
  textOutput,
  unsafeBytesFromLatin1,
} from "./encoding";
