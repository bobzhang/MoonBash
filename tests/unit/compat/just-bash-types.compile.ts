import {
  Bash,
  BashTransformPipeline,
  CommandCollectorPlugin,
  DefenseInDepthBox,
  InMemoryFs,
  MountableFs,
  OverlayFs,
  ReadWriteFs,
  Sandbox,
  TeePlugin,
  EMPTY_BYTES,
  bytesOutput,
  decodeBytesToUtf8,
  defineCommand,
  encodeUtf8ToBytes,
  getCommandNames,
  getJavaScriptCommandNames,
  getNetworkCommandNames,
  getPythonCommandNames,
  parse,
  serialize,
  textOutput,
  type AllCommandName,
  type AllowedUrl,
  type AllowedUrlEntry,
  type BashOptions,
  type BashTransformResult,
  type ByteString,
  type Command,
  type CommandCollectorMetadata,
  type CommandContext,
  type CommandName,
  type CpOptions,
  type DirectoryEntry,
  type DirentEntry,
  type ExecOptions,
  type ExecResult,
  type FileContent,
  type FileEntry,
  type FileInit,
  type FileSystemFactory,
  type FsEntry,
  type FsStat,
  type IFileSystem,
  type JavaScriptConfig,
  type JavaScriptCommandName,
  type LazyCommand,
  type LazyFileEntry,
  type LazyFileProvider,
  type MkdirOptions,
  type MountConfig,
  type MountableFsOptions,
  type NetworkConfig,
  type NetworkCommandName,
  type OutputKind,
  type OutputMessage,
  type OverlayFsOptions,
  type PythonCommandName,
  type ReadFileOptions,
  type ReadWriteFsOptions,
  type RequestTransform,
  type RmOptions,
  type RunCommandParams,
  type SandboxCommandFinished,
  type SandboxOptions,
  type SecureFetch,
  type SymlinkEntry,
  type TeeFileInfo,
  type TeePluginMetadata,
  type TeePluginOptions,
  type TransformContext,
  type TransformPlugin,
  type TransformResult,
  type WriteFileOptions,
} from "../../../wrapper/index";

const bytes: ByteString = encodeUtf8ToBytes("hello");
const emptyBytes: ByteString = EMPTY_BYTES;
decodeBytesToUtf8(bytes);
decodeBytesToUtf8(emptyBytes);
textOutput("hello");
bytesOutput(bytes);

const command = defineCommand("upper", async (_args: string[], ctx: CommandContext) => {
  const text = decodeBytesToUtf8(ctx.stdin).toUpperCase();
  return { stdout: text, stderr: "", exitCode: 0, stdoutKind: "text" };
});

const commandName: CommandName = "echo";
const allCommandName: AllCommandName = "curl";
const networkCommandName: NetworkCommandName = "curl";
const pythonCommandName: PythonCommandName = "python3";
const javaScriptCommandName: JavaScriptCommandName = "js-exec";
const outputKind: OutputKind = "text";
const requestTransform: RequestTransform = { headers: { "x-test": "1" } };
const allowedUrl: AllowedUrl = { url: "https://example.com", transform: [requestTransform] };
const allowedUrlEntry: AllowedUrlEntry = allowedUrl;
const network: NetworkConfig = { allowedUrlPrefixes: ["https://example.com"] };
const secureFetch: SecureFetch = async (url) => ({
  status: 200,
  statusText: "OK",
  headers: {},
  body: new Uint8Array(),
  url,
});
const javascript: JavaScriptConfig = {
  bootstrap: "globalThis.x = 1;",
  invokeTool: async () => "{}",
};

const options: BashOptions = {
  files: { "/data.txt": "hello" },
  env: { A: "1" },
  cwd: "/home/user",
  maxCallDepth: 10,
  maxCommandCount: 20,
  maxLoopIterations: 30,
  processInfo: {
    pid: 101,
    ppid: 100,
    uid: 1000,
    gid: 1000,
  },
  python: true,
  javascript,
  network,
  fetch: secureFetch,
  customCommands: [command],
  defenseInDepth: true,
  trace: (event) => {
    event.category.toUpperCase();
    event.name.toUpperCase();
    event.durationMs.toFixed();
  },
};
const lazyCommand: LazyCommand = {
  name: "lazy",
  load: async () => command,
};
const execResult: ExecResult = { stdout: "", stderr: "", exitCode: 0 };

const execOptions: ExecOptions = {
  env: { B: "2" },
  replaceEnv: true,
  cwd: "/",
  stdin: "hello",
  stdinKind: "text",
  args: ["one"],
  signal: new AbortController().signal,
};

const bash = new Bash(options);
bash.registerCommand(command);
void bash.exec("echo hello", execOptions);
const bashFs: IFileSystem = bash.fs;
void bashFs.readFile("/data.txt");
void bash.readFile("/data.txt");
void bash.writeFile("/data.txt", "updated");
bash.registerTransformPlugin(new CommandCollectorPlugin());
bash.transform("echo hello");

getCommandNames();
getNetworkCommandNames();
getPythonCommandNames();
getJavaScriptCommandNames();

const fs: IFileSystem = new InMemoryFs();
const fileContent: FileContent = "content";
const readOptions: ReadFileOptions = { encoding: "utf8" };
const writeOptions: WriteFileOptions = { encoding: "utf8" };
const fileEntry: FileEntry = { type: "file", content: fileContent, mode: 0o644, mtime: new Date() };
const lazyFileEntry: LazyFileEntry = {
  type: "file",
  lazy: async () => "lazy",
  mode: 0o644,
  mtime: new Date(),
};
const directoryEntry: DirectoryEntry = { type: "directory", mode: 0o755, mtime: new Date() };
const symlinkEntry: SymlinkEntry = { type: "symlink", target: "/target", mode: 0o777, mtime: new Date() };
const fsEntry: FsEntry = fileEntry;
const fsStat: FsStat = {
  isFile: true,
  isDirectory: false,
  isSymbolicLink: false,
  mode: 0o644,
  size: 7,
  mtime: new Date(),
};
const fileInit: FileInit = { content: "hello", mode: 0o600, mtime: new Date() };
const lazyFileProvider: LazyFileProvider = async () => "lazy";
const fileSystemFactory: FileSystemFactory = () => new InMemoryFs();
const mkdirOptions: MkdirOptions = { recursive: true };
const rmOptions: RmOptions = { recursive: true, force: true };
const cpOptions: CpOptions = { recursive: true };
const dirent: DirentEntry = {
  name: "file.txt",
  isFile: true,
  isDirectory: false,
  isSymbolicLink: false,
};
const mountableOptions: MountableFsOptions = { base: fs };
const mountConfig: MountConfig = { mountPoint: "/mnt", filesystem: fs };
const overlayOptions: OverlayFsOptions = { root: process.cwd() };
const readWriteOptions: ReadWriteFsOptions = { root: process.cwd() };
const sandboxOptions: SandboxOptions = { cwd: "/", fs };
const runCommandParams: RunCommandParams = { cmd: "echo", args: ["hello"], detached: false };
const outputMessage: OutputMessage = { type: "stdout", data: "hello", timestamp: new Date() };
const mountableFs = new MountableFs({ base: fs });
mountableFs.mount("/mnt", new InMemoryFs());
mountableFs.unmount("/mnt");
mountableFs.getMounts();
mountableFs.isMountPoint("/mnt");
new OverlayFs({ root: process.cwd() });
new ReadWriteFs({ root: process.cwd() });
void readOptions;
void writeOptions;
void commandName;
void allCommandName;
void networkCommandName;
void pythonCommandName;
void javaScriptCommandName;
void outputKind;
void allowedUrlEntry;
void lazyCommand;
void execResult;
void fileEntry;
void lazyFileEntry;
void directoryEntry;
void symlinkEntry;
void fsEntry;
void fsStat;
void fileInit;
void lazyFileProvider;
void fileSystemFactory;
void mkdirOptions;
void rmOptions;
void cpOptions;
void dirent;
void mountableOptions;
void mountConfig;
void overlayOptions;
void readWriteOptions;
void sandboxOptions;
void runCommandParams;
void outputMessage;

const ast = parse("echo hello");
serialize(ast);
const teeOptions: TeePluginOptions = { outputDir: "/tmp" };
const teePlugin = new TeePlugin(teeOptions);
const transformPlugin: TransformPlugin = teePlugin;
const transformPipeline = new BashTransformPipeline().use(transformPlugin);
const pipelineResult: BashTransformResult<TeePluginMetadata> = new BashTransformPipeline()
  .use(teePlugin)
  .transform("echo hello");
const transformResult: TransformResult = { ast };
const transformContext: TransformContext = { ast, metadata: {} };
const commandCollectorMetadata: CommandCollectorMetadata = { commands: ["echo"] };
const teeFileInfo: TeeFileInfo = { path: "/tmp/echo.stdout.txt", fd: 1 };
const teeMetadata: TeePluginMetadata = { teeFiles: [teeFileInfo] };
void transformResult;
void pipelineResult;
void transformContext;
void commandCollectorMetadata;
void teeMetadata;

DefenseInDepthBox.isInSandboxedContext();
void Sandbox.create(sandboxOptions).then(async (sandbox) => {
  const command: SandboxCommandFinished = await sandbox.runCommand(runCommandParams);
  command.exitCode.toFixed();
  await command.stdout();
  await command.stderr();
  await command.output();
  for await (const message of command.logs()) {
    message.timestamp.toISOString();
  }
  await sandbox.writeFiles({ "/tmp/a.txt": "a" });
  await sandbox.readFile("/tmp/a.txt", "utf-8");
  await sandbox.mkDir("/tmp/dir", { recursive: true });
  await sandbox.stop();
  await sandbox.extendTimeout(1000);
  sandbox.domain?.toString();
  sandbox.bashEnvInstance.getCwd();
});
