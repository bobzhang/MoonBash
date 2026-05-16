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
  type SecureFetch,
  type WriteFileOptions,
} from "../../../src/wrapper/index";

const bytes: ByteString = encodeUtf8ToBytes("hello");
decodeBytesToUtf8(bytes);
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
  python: true,
  javascript,
  network,
  fetch: secureFetch,
  customCommands: [command],
  defenseInDepth: true,
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
new MountableFs({ base: fs });
new OverlayFs({ root: process.cwd() });
new ReadWriteFs({ root: process.cwd() });
void readOptions;
void writeOptions;
void dirent;
void mountableOptions;
void overlayOptions;
void readWriteOptions;

const ast = parse("echo hello");
serialize(ast);
new BashTransformPipeline().use(new TeePlugin({ outputDir: "/tmp" })).transform("echo hello");

DefenseInDepthBox.isInSandboxedContext();
void Sandbox.create({ cwd: "/home/user" });
