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
  type BashOptions,
  type ByteString,
  type CommandContext,
  type DirentEntry,
  type ExecOptions,
  type IFileSystem,
  type JavaScriptConfig,
  type MountableFsOptions,
  type NetworkConfig,
  type OverlayFsOptions,
  type ReadFileOptions,
  type ReadWriteFsOptions,
  type RunCommandParams,
  type SandboxCommandFinished,
  type SandboxOptions,
  type SecureFetch,
  type WriteFileOptions,
} from "../../../src/wrapper/index";

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
void bash.exec("echo hello", execOptions);
void bash.readFile("/data.txt");
void bash.writeFile("/data.txt", "updated");
bash.registerTransformPlugin(new CommandCollectorPlugin());
bash.transform("echo hello");

getCommandNames();
getNetworkCommandNames();
getPythonCommandNames();
getJavaScriptCommandNames();

const fs: IFileSystem = new InMemoryFs();
const readOptions: ReadFileOptions = { encoding: "utf8" };
const writeOptions: WriteFileOptions = { encoding: "utf8" };
const dirent: DirentEntry = {
  name: "file.txt",
  isFile: true,
  isDirectory: false,
  isSymbolicLink: false,
};
const mountableOptions: MountableFsOptions = { base: fs };
const overlayOptions: OverlayFsOptions = { root: process.cwd() };
const readWriteOptions: ReadWriteFsOptions = { root: process.cwd() };
const sandboxOptions: SandboxOptions = { cwd: "/", fs };
const runCommandParams: RunCommandParams = { cmd: "echo", args: ["hello"], detached: false };
const mountableFs = new MountableFs({ base: fs });
mountableFs.mount("/mnt", new InMemoryFs());
mountableFs.unmount("/mnt");
mountableFs.getMounts();
mountableFs.isMountPoint("/mnt");
new OverlayFs({ root: process.cwd() });
new ReadWriteFs({ root: process.cwd() });
void readOptions;
void writeOptions;
void dirent;
void mountableOptions;
void overlayOptions;
void readWriteOptions;
void sandboxOptions;
void runCommandParams;

const ast = parse("echo hello");
serialize(ast);
new BashTransformPipeline().use(new TeePlugin({ outputDir: "/tmp" })).transform("echo hello");

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
