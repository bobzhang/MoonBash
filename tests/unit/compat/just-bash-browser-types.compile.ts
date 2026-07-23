import {
  Bash,
  InMemoryFs,
  MountableFs,
  NetworkAccessDeniedError,
  RedirectNotAllowedError,
  TooManyRedirectsError,
  defineCommand,
  getCommandNames,
  getNetworkCommandNames,
  type AllCommandName,
  type BashExecResult,
  type BashLogger,
  type BashOptions,
  type BufferEncoding,
  type Command,
  type CommandContext,
  type CommandName,
  type CpOptions,
  type CustomCommand,
  type DirectoryEntry,
  type ExecOptions,
  type ExecResult,
  type FileContent,
  type FileEntry,
  type FileInit,
  type FileSystemFactory,
  type FsEntry,
  type FsStat,
  type IFileSystem,
  type InitialFiles,
  type LazyCommand,
  type LazyFileEntry,
  type LazyFileProvider,
  type MkdirOptions,
  type MountConfig,
  type MountableFsOptions,
  type NetworkCommandName,
  type NetworkConfig,
  type RmOptions,
  type SymlinkEntry,
} from "../../../wrapper/browser";

const logger: BashLogger = {
  info: (message: string) => String(message),
  debug: (message: string) => String(message),
};

const fs: IFileSystem = new InMemoryFs();
const command = defineCommand("upper", async (_args: string[], ctx: CommandContext) => {
  ctx.cwd.toString();
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
  };
});
const typedCommand: Command = command;
const lazyCommand: LazyCommand = {
  name: "lazy",
  load: async () => command,
};
const customCommand: CustomCommand = lazyCommand;
const files: InitialFiles = { "/data.txt": "hello" };
const network: NetworkConfig = { allowedUrlPrefixes: ["https://example.com"] };
const options: BashOptions = {
  files,
  logger,
  customCommands: [customCommand],
  network,
};
const execOptions: ExecOptions = { stdin: "hello", cwd: "/" };
const execResult: ExecResult = { stdout: "", stderr: "", exitCode: 0 };
const bashExecResult: BashExecResult = { ...execResult, env: {} };

const bufferEncoding: BufferEncoding = "utf8";
const fileContent: FileContent = new Uint8Array([1, 2, 3]);
const fileEntry: FileEntry = {
  type: "file",
  content: fileContent,
  mode: 0o644,
  mtime: new Date(),
};
const lazyFileEntry: LazyFileEntry = {
  type: "file",
  lazy: async () => "lazy",
  mode: 0o644,
  mtime: new Date(),
};
const directoryEntry: DirectoryEntry = {
  type: "directory",
  mode: 0o755,
  mtime: new Date(),
};
const symlinkEntry: SymlinkEntry = {
  type: "symlink",
  target: "/target",
  mode: 0o777,
  mtime: new Date(),
};
const fsEntry: FsEntry = fileEntry;
const fileInit: FileInit = { content: "hello" };
const fsStat: FsStat = {
  isFile: true,
  isDirectory: false,
  isSymbolicLink: false,
  mode: 0o644,
  size: 5,
  mtime: new Date(),
};
const lazyProvider: LazyFileProvider = async () => "lazy";
const fsFactory: FileSystemFactory = () => new InMemoryFs();
const mkdirOptions: MkdirOptions = { recursive: true };
const rmOptions: RmOptions = { recursive: true, force: true };
const cpOptions: CpOptions = { recursive: true };
const mountConfig: MountConfig = { mountPoint: "/mnt", filesystem: fs };
const mountableOptions: MountableFsOptions = { base: fs, mounts: [mountConfig] };
const commandName: CommandName = "echo";
const allCommandName: AllCommandName = "curl";
const networkCommandName: NetworkCommandName = "curl";

const bash = new Bash(options);
void bash.exec("echo hello", execOptions);
const mountableFs = new MountableFs(mountableOptions);
mountableFs.mount("/tmp", new InMemoryFs());
getCommandNames();
getNetworkCommandNames();
new NetworkAccessDeniedError("https://example.com");
new RedirectNotAllowedError("https://example.com");
new TooManyRedirectsError(3);

void typedCommand;
void bashExecResult;
void bufferEncoding;
void fileEntry;
void lazyFileEntry;
void directoryEntry;
void symlinkEntry;
void fsEntry;
void fileInit;
void fsStat;
void lazyProvider;
void fsFactory;
void mkdirOptions;
void rmOptions;
void cpOptions;
void commandName;
void allCommandName;
void networkCommandName;
