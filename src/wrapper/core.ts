/**
 * MoonBash - Zero-dependency POSIX Shell Sandbox
 *
 * API-compatible with vercel-labs/just-bash.
 * Compiled from MoonBit to pure JavaScript (no WASM).
 */

import type {
  BashExecResult,
  BashLogger,
  FeatureCoverageWriter,
  ExecResult,
  ExecOptions,
  BashOptions,
  Command,
  CommandContext,
  CustomCommand,
  LazyCommand,
  ExecutionLimits,
  FileSystem,
  InitialFileEntry,
  InitialFileValue,
  InitialFiles,
  MoonBashFetchRequest,
  MoonBashFetchResponse,
  MoonBashVmRequest,
  MoonBashVmResponse,
  JavaScriptConfig,
} from "./types";
import {
  getCommandNames,
  getJavaScriptCommandNames,
  getNetworkCommandNames,
  getPythonCommandNames,
} from "./commands/registry";
import { parse } from "./parser";
import { serialize } from "./transform";
import {
  bytesFromUint8Array,
  decodeBytesToUtf8,
  encodeUtf8ToBytes,
  latin1FromBytes,
  type ByteString,
  unsafeBytesFromLatin1,
  uint8ArrayFromBytes,
} from "./encoding";
import {
  type BufferEncoding,
  type CpOptions,
  type DirentEntry as AsyncDirentEntry,
  type FileContent,
  type FsStat,
  type IFileSystem,
  type MkdirOptions,
  type ReadFileOptions,
  type RmOptions,
  type WriteFileOptions,
} from "./fs";
import type { BashTransformResult, TransformPlugin } from "./transform";

export type {
  BashExecResult,
  BashLogger,
  FeatureCoverageWriter,
  ExecResult,
  ExecOptions,
  BashOptions,
  Command,
  CommandContext,
  CustomCommand,
  LazyCommand,
  FileSystem,
  InitialFileEntry,
  InitialFileValue,
  InitialFiles,
  MoonBashFetchRequest,
  MoonBashFetchResponse,
  NetworkOptions,
  ExecutionLimits,
  MoonBashVmRequest,
  MoonBashVmResponse,
  TimerOptions,
  JavaScriptConfig,
  TraceCallback,
  TraceEvent,
  VmOptions,
} from "./types";
export type {
  AllCommandName,
  CommandName,
  JavaScriptCommandName,
  NetworkCommandName,
  PythonCommandName,
} from "./commands/registry";
export {
  getCommandNames,
  getJavaScriptCommandNames,
  getNetworkCommandNames,
  getPythonCommandNames,
} from "./commands/registry";
export type {
  BufferEncoding,
  CpOptions,
  DirectoryEntry,
  DirentEntry,
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
  MountConfig,
  MountableFsOptions,
  ReadFileOptions,
  RmOptions,
  SymlinkEntry,
  WriteFileOptions,
} from "./fs";
export {
  InMemoryFs,
  MountableFs,
} from "./fs";
export type {
  AllowedUrl,
  AllowedUrlEntry,
  FetchResult,
  HttpMethod,
  NetworkConfig,
  RequestTransform,
  SecureFetch,
  SecureFetchOptions,
} from "./network";
export {
  NetworkAccessDeniedError,
  RedirectNotAllowedError,
  TooManyRedirectsError,
} from "./network";
export type {
  DefenseInDepthConfig,
  DefenseInDepthHandle,
  DefenseInDepthStats,
  SecurityViolation,
  SecurityViolationType,
} from "./security";
export {
  createConsoleViolationCallback,
  DefenseInDepthBox,
  SecurityViolationError,
  SecurityViolationLogger,
} from "./security";
export type {
  CommandNode,
  PipelineNode,
  ScriptNode,
  SimpleCommandNode,
  StatementNode,
  WordNode,
} from "./parser";
export { parse } from "./parser";
export {
  BashTransformPipeline,
  CommandCollectorPlugin,
  serialize,
  TeePlugin,
} from "./transform";
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
export type {
  BashTransformResult,
  CommandCollectorMetadata,
  TeeFileInfo,
  TeePluginMetadata,
  TeePluginOptions,
  TransformContext,
  TransformPlugin,
  TransformResult,
} from "./transform";

// Import the compiled MoonBit engine from the release build used by packaging.
// @ts-ignore - generated file has no type declarations
import { execute_with_state as mbExecuteWithState } from "../_build/js/release/build/lib/entry/entry.js";

interface StateExecResult extends ExecResult {
  files?: Record<string, string>;
  dirs?: Record<string, string>;
  links?: Record<string, string>;
  modes?: Record<string, string>;
  env?: Record<string, string>;
}

type MoonBashFetchBridge = (requestJson: string) => string;
type MoonBashSleepBridge = (durationMs: number) => string;
type MoonBashNowBridge = () => number;
type MoonBashWallNowBridge = () => number;
type MoonBashVmBridge = (requestJson: string) => string;
type MoonBashCustomBridge = (requestJson: string) => string;

interface MoonBashCustomRequest {
  name: string;
  args: string[];
  stdin?: string;
  cwd?: string;
  env?: Record<string, string>;
  files?: Record<string, string>;
}

interface MoonBashCustomResponse {
  handled: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  files?: Record<string, string>;
}

const DEFAULT_COMMAND_NAMES: string[] = [
  "echo",
  "cat",
  "pwd",
  "ls",
  "mkdir",
  "rm",
  "cp",
  "mv",
  "touch",
  "find",
  "head",
  "tail",
  "wc",
  "awk",
  "jq",
  "true",
  "false",
  "rmdir",
  "stat",
  "file",
  "tree",
  "du",
  "chmod",
  "ln",
  "readlink",
  "diff",
  "cmp",
  "comm",
  "base64",
  "expr",
  "yq",
  "xan",
  "csvlook",
  "md5sum",
  "sha1sum",
  "sha256sum",
  "gzip",
  "gunzip",
  "zcat",
  "python3",
  "sqlite3",
  "export",
  "unset",
  "set",
  "shift",
  "exit",
  "return",
  "break",
  "continue",
  "read",
  "mapfile",
  "readarray",
  "test",
  "[",
  "[[",
  "printf",
  "eval",
  "source",
  ".",
  "local",
  "declare",
  "typeset",
  "let",
  ":",
  "type",
  "command",
  "basename",
  "dirname",
  "seq",
  "rev",
  "nl",
  "fold",
  "expand",
  "unexpand",
  "paste",
  "column",
  "join",
  "tr",
  "sort",
  "uniq",
  "cut",
  "tee",
  "sed",
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "xargs",
  "date",
  "env",
  "printenv",
  "which",
  "whoami",
  "hostname",
  "help",
  "clear",
  "history",
  "tac",
  "od",
  "alias",
  "unalias",
  "bash",
  "sh",
  "time",
  "sleep",
  "timeout",
];
const DEFAULT_BIN_STUB_PREFIX = "# moon_bash command stub:";

interface PyodideFsLike {
  analyzePath(path: string): { exists: boolean };
  mkdir(path: string): void;
  readdir(path: string): string[];
  stat(path: string): { mode: number };
  isDir(mode: number): boolean;
  readFile(path: string, options?: { encoding: "utf8" }): string;
  writeFile(path: string, data: string): void;
  unlink(path: string): void;
}

interface PyodideRuntimeLike {
  FS: PyodideFsLike;
  globals: {
    set(name: string, value: unknown): void;
  };
  runPython(code: string): unknown;
}

interface SqlJsResultLike {
  values: unknown[][];
}

interface SqlJsDatabaseLike {
  exec(sql: string): SqlJsResultLike[];
  run(sql: string): void;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsRuntimeLike {
  Database: new (data?: Uint8Array) => SqlJsDatabaseLike;
}

interface NodeWorkerLike {
  postMessage(message: unknown): void;
  terminate(): Promise<number> | number;
  unref?(): void;
  on(event: "message", listener: (message: unknown) => void): this;
  on(event: "error", listener: (error: unknown) => void): this;
  off?(event: "message" | "error", listener: (...args: unknown[]) => void): this;
  removeListener?(event: "message" | "error", listener: (...args: unknown[]) => void): this;
}

interface NodeWorkerBridgeContext {
  limitsJson: string;
  layoutMode: "default" | "minimal";
  fetchBridge?: MoonBashFetchBridge;
  sleepBridge?: MoonBashSleepBridge;
  nowBridge?: MoonBashNowBridge;
  wallNowBridge?: MoonBashWallNowBridge;
  vmBridge?: MoonBashVmBridge;
}

interface NodeWorkerPendingExec {
  resolve: (result: StateExecResult) => void;
  reject: (error: Error) => void;
}

interface JavaScriptParsedArgs {
  code: string;
  filename: string;
  argv: string[];
}

type JavaScriptRequire = ((name: string) => unknown) & { resolve(name: string): string };

interface SqlJsInitOptions {
  locateFile?: (file: string) => string;
}

type SqlJsInitLike = (options?: SqlJsInitOptions) => Promise<SqlJsRuntimeLike>;
type VmBridgeImpl = (
  request: MoonBashVmRequest,
) => MoonBashVmResponse | Promise<MoonBashVmResponse>;

const INTERNAL_SHELL_COMMAND_NAMES = [
  "export",
  "unset",
  "set",
  "shift",
  "exec",
  "exit",
  "return",
  "break",
  "continue",
  "read",
  "readarray",
  "mapfile",
  "test",
  "[",
  "[[",
  "printf",
  "eval",
  "source",
  ".",
  "local",
  "readonly",
  "declare",
  "typeset",
  "getopts",
  "let",
  ":",
  "type",
  "command",
  "builtin",
  "hash",
  "shopt",
  "complete",
  "compgen",
  "compopt",
  "pushd",
  "popd",
  "dirs",
  "cd",
] as const;

const PYODIDE_EXEC_SNIPPET = `
import contextlib
import io
import json
import os
import runpy
import sys
import traceback

_request = json.loads(__moon_bash_request_json)
_args = _request.get("args") or []
_stdin = _request.get("stdin") or ""
_cwd = _request.get("cwd") or "/"
_env = _request.get("env") or {}

_stdout_io = io.StringIO()
_stderr_io = io.StringIO()
_exit_code = 0

_old_stdin = sys.stdin
_old_argv = list(sys.argv)
_old_cwd = os.getcwd()
_old_env = os.environ.copy()

try:
    sys.stdin = io.StringIO(_stdin)
    sys.argv = ["python3"] + list(_args)
    os.environ.clear()
    for _k, _v in _env.items():
        os.environ[str(_k)] = str(_v)

    if _cwd:
        os.makedirs(_cwd, exist_ok=True)
        os.chdir(_cwd)

    with contextlib.redirect_stdout(_stdout_io), contextlib.redirect_stderr(_stderr_io):
        if len(_args) == 0:
            _exit_code = 0
        elif _args[0] == "-c":
            _code = _args[1] if len(_args) > 1 else ""
            sys.argv = ["-c"] + _args[2:]
            exec(compile(_code, "<string>", "exec"), {"__name__": "__main__"})
        elif _args[0] == "-m":
            if len(_args) < 2:
                raise SystemExit(2)
            _mod = _args[1]
            sys.argv = [_mod] + _args[2:]
            runpy.run_module(_mod, run_name="__main__", alter_sys=True)
        else:
            _script = _args[0]
            sys.argv = [_script] + _args[1:]
            runpy.run_path(_script, run_name="__main__")
except SystemExit as _e:
    _code = _e.code
    if isinstance(_code, int):
        _exit_code = _code
    elif _code is None:
        _exit_code = 0
    else:
        _exit_code = 1
        _text = str(_code)
        if _text:
            _stderr_io.write(_text)
            if not _text.endswith("\\n"):
                _stderr_io.write("\\n")
except BaseException:
    _exit_code = 1
    _stderr_io.write(traceback.format_exc())
finally:
    sys.stdin = _old_stdin
    sys.argv = _old_argv
    os.chdir(_old_cwd)
    os.environ.clear()
    os.environ.update(_old_env)

json.dumps({
    "stdout": _stdout_io.getvalue(),
    "stderr": _stderr_io.getvalue(),
    "exitCode": int(_exit_code),
})
`.trim();

declare global {
  // eslint-disable-next-line no-var
  var __moon_bash_fetch: MoonBashFetchBridge | undefined;
  // eslint-disable-next-line no-var
  var __moon_bash_sleep: MoonBashSleepBridge | undefined;
  // eslint-disable-next-line no-var
  var __moon_bash_now: MoonBashNowBridge | undefined;
  // eslint-disable-next-line no-var
  var __moon_bash_wall_now: MoonBashWallNowBridge | undefined;
  // eslint-disable-next-line no-var
  var __moon_bash_vm: MoonBashVmBridge | undefined;
  // eslint-disable-next-line no-var
  var __moon_bash_custom: MoonBashCustomBridge | undefined;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function stringifyPrimitive(value: boolean | number | bigint | symbol): string {
  return String(value);
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function waitForPromise<T>(promise: Promise<T>): T {
  if (typeof SharedArrayBuffer === "undefined" || typeof Atomics === "undefined") {
    throw new Error("moon_bash: async bridge requires SharedArrayBuffer and Atomics support");
  }

  const signal = new Int32Array(new SharedArrayBuffer(4));
  let resolved: T | undefined;
  let rejected: unknown;

  promise.then(
    (value) => {
      resolved = value;
      Atomics.store(signal, 0, 1);
      Atomics.notify(signal, 0, 1);
    },
    (error) => {
      rejected = error;
      Atomics.store(signal, 0, 2);
      Atomics.notify(signal, 0, 1);
    },
  );

  while (Atomics.load(signal, 0) === 0) {
    try {
      Atomics.wait(signal, 0, 0, 100);
    } catch {
      throw new Error("moon_bash: Atomics.wait is not available in this runtime");
    }
  }

  if (Atomics.load(signal, 0) === 2) {
    throw rejected;
  }
  return resolved as T;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const JS_EXEC_HELP = `js-exec - Sandboxed JavaScript/TypeScript runtime with Node.js-compatible APIs

Usage: js-exec [OPTIONS] [-c CODE | FILE] [ARGS...]

Options:
  -c CODE          Execute inline code
  -m, --module     Enable ES module mode (import/export)
  --strip-types    Strip TypeScript type annotations
  --version, -V    Show version
  --help           Show this help

Examples:
  js-exec -c "console.log(1 + 2)"
  js-exec script.js
  js-exec app.ts
  echo 'console.log("hello")' | js-exec
`;

class JavaScriptProcessExit extends Error {
  constructor(readonly code: number) {
    super(`process exited with code ${code}`);
  }
}

function formatJavaScriptConsoleValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createJavaScriptToolsProxy(
  invokeTool: NonNullable<JavaScriptConfig["invokeTool"]>,
  segments: string[] = [],
): unknown {
  return new Proxy(() => undefined, {
    get(_target, property) {
      if (property === "then" || property === "catch" || property === "finally") {
        return undefined;
      }
      if (typeof property === "symbol") {
        return undefined;
      }
      return createJavaScriptToolsProxy(invokeTool, [...segments, property]);
    },
    async apply(_target, _thisArg, args) {
      if (segments.length === 0) {
        throw new Error("tools proxy requires a tool path");
      }
      const argsJsonValue = args.length > 0 ? JSON.stringify(args[0]) : "";
      const resultJson = await invokeTool(
        segments.join("."),
        argsJsonValue === undefined ? "" : argsJsonValue,
      );
      return resultJson.length === 0 ? undefined : JSON.parse(resultJson);
    },
  });
}

function normalizePosixPath(inputPath: string, cwd = "/"): string {
  const base = inputPath.startsWith("/")
    ? inputPath
    : cwd === "/"
      ? `/${inputPath}`
      : `${cwd}/${inputPath}`;
  const parts = base.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (out.length > 0) {
        out.pop();
      }
      continue;
    }
    out.push(part);
  }
  return out.length === 0 ? "/" : `/${out.join("/")}`;
}

function normalizeModulePath(inputPath: string): string {
  const normalized = normalizePosixPath(inputPath);
  if (inputPath.endsWith("/") && normalized !== "/") {
    return `${normalized}/`;
  }
  return normalized;
}

function dirnamePosixPath(inputPath: string): string {
  if (!inputPath) {
    return ".";
  }
  const normalized = normalizeModulePath(inputPath);
  if (normalized === "/") {
    return "/";
  }
  const trimmed = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return trimmed.startsWith("/") ? "/" : ".";
  }
  return trimmed.slice(0, slash);
}

function basenamePosixPath(inputPath: string, ext = ""): string {
  const trimmed = inputPath.endsWith("/") && inputPath !== "/" ? inputPath.slice(0, -1) : inputPath;
  const slash = trimmed.lastIndexOf("/");
  const base = slash === -1 ? trimmed : trimmed.slice(slash + 1);
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

function extnamePosixPath(inputPath: string): string {
  const base = basenamePosixPath(inputPath);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot);
}

function relativePosixPath(from: string, to: string): string {
  const fromParts = normalizePosixPath(from).split("/").filter(Boolean);
  const toParts = normalizePosixPath(to).split("/").filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common += 1;
  }
  return [
    ...Array.from({ length: fromParts.length - common }, () => ".."),
    ...toParts.slice(common),
  ].join("/") || "";
}

interface JavaScriptPathModule {
  sep: "/";
  delimiter: ":";
  posix: JavaScriptPathModule;
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  normalize(path: string): string;
  isAbsolute(path: string): boolean;
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
  extname(path: string): string;
  relative(from: string, to: string): string;
  parse(path: string): { root: string; dir: string; base: string; ext: string; name: string };
  format(pathObject: { root?: string; dir?: string; base?: string; name?: string; ext?: string }): string;
}

function listChildren(paths: string[], dirPath: string): string[] {
  const prefix = dirPath === "/" ? "/" : `${dirPath}/`;
  const names = new Set<string>();
  for (const path of paths) {
    if (!path.startsWith(prefix) || path === dirPath) {
      continue;
    }
    const rest = path.slice(prefix.length);
    if (!rest) {
      continue;
    }
    const slash = rest.indexOf("/");
    names.add(slash === -1 ? rest : rest.slice(0, slash));
  }
  return [...names].sort();
}

export function isLazyCommand(command: CustomCommand): command is LazyCommand {
  return typeof (command as LazyCommand).load === "function";
}

export function defineCommand(
  name: string,
  fn: (args: string[], ctx: CommandContext) => Promise<ExecResult>,
): Command {
  return {
    name,
    execute: fn,
  };
}

export function createLazyCustomCommand(lazyCommand: LazyCommand): Command {
  let loaded: Command | null = null;
  return {
    name: lazyCommand.name,
    async execute(args: string[], ctx: CommandContext): Promise<ExecResult> {
      if (!loaded) {
        loaded = await lazyCommand.load();
      }
      return loaded.execute(args, ctx);
    },
  };
}

/**
 * Main entry point for executing bash commands in a sandboxed environment.
 *
 * @example
 * ```ts
 * const bash = new Bash();
 * const result = await bash.exec('echo "hello world"');
 * console.log(result.stdout); // "hello world\n"
 * ```
 */
export class Bash {
  private options: BashOptions;
  private baseCwd: string;
  private baseEnv: Record<string, string>;
  private useDefaultLayout: boolean;
  private files: Record<string, string>;
  private dirs: Record<string, string>;
  private links: Record<string, string>;
  private modes: Record<string, string>;
  private eagerCustomCommands: Map<string, Command>;
  private lazyCustomCommands: Map<string, LazyCommand>;
  private pyodideRuntime: PyodideRuntimeLike | null;
  private pyodideRuntimePromise: Promise<PyodideRuntimeLike> | null;
  private sqlJsRuntime: SqlJsRuntimeLike | null;
  private sqlJsRuntimePromise: Promise<SqlJsRuntimeLike> | null;
  private pyodideTrackedFiles: Set<string>;
  private externalFsApplyState: ((
    files: Record<string, string>,
    dirs?: Record<string, string>,
    links?: Record<string, string>,
    modes?: Record<string, string>,
  ) => void) | null;
  private nodeExecWorker: NodeWorkerLike | null;
  private nodeExecWorkerInitPromise: Promise<NodeWorkerLike> | null;
  private nodeExecWorkerPendingExec: Map<number, NodeWorkerPendingExec>;
  private nodeExecWorkerExecSeq: number;
  private nodeExecWorkerBridgeContext: NodeWorkerBridgeContext | null;
  private nodeExecWorkerQueue: Promise<void>;
  private nodeEntryModuleUrlPromise: Promise<string> | null;
  private nodeExecWorkerIdleTimer: ReturnType<typeof setTimeout> | null;
  private transformPlugins: TransformPlugin<object>[] = [];
  private readonly binaryFsPaths = new Set<string>();
  private readonly syncFs: FileSystem;
  readonly fs: IFileSystem;

  constructor(options: BashOptions = {}) {
    const normalizedOptions: BashOptions = { ...options };
    const fsSnapshot = this.extractFsSnapshot((options as { fs?: unknown }).fs);
    if (fsSnapshot) {
      normalizedOptions.files = {
        ...normalizedOptions.files,
        ...fsSnapshot,
      };
    }
    if (typeof options.sleep === "function" && !options.timers?.sleep) {
      normalizedOptions.timers = { ...options.timers, sleep: options.sleep };
    }

    this.options = normalizedOptions;
    this.baseCwd =
      normalizedOptions.cwd && normalizedOptions.cwd.length > 0
        ? normalizedOptions.cwd
        : normalizedOptions.files
          ? "/"
          : "/home/user";
    this.baseEnv = {
      ...normalizedOptions.env,
      ...this.createVirtualProcessEnv(normalizedOptions.processInfo),
    };
    this.useDefaultLayout = normalizedOptions.files === undefined && !normalizedOptions.cwd;
    const initialFs = this.normalizeInitialFiles(normalizedOptions.files);
    this.files = initialFs.files;
    this.dirs = {};
    this.links = {};
    this.modes = initialFs.modes;
    this.eagerCustomCommands = new Map();
    this.lazyCustomCommands = new Map();
    this.pyodideRuntime = null;
    this.pyodideRuntimePromise = null;
    this.sqlJsRuntime = null;
    this.sqlJsRuntimePromise = null;
    this.pyodideTrackedFiles = new Set();
    this.externalFsApplyState = this.extractFsApplyState((options as { fs?: unknown }).fs);
    this.nodeExecWorker = null;
    this.nodeExecWorkerInitPromise = null;
    this.nodeExecWorkerPendingExec = new Map();
    this.nodeExecWorkerExecSeq = 1;
    this.nodeExecWorkerBridgeContext = null;
    this.nodeExecWorkerQueue = Promise.resolve();
    this.nodeEntryModuleUrlPromise = null;
    this.nodeExecWorkerIdleTimer = null;

    if (normalizedOptions.javascript) {
      const javaScriptCommands = this.createJavaScriptRuntimeCommands(normalizedOptions.javascript);
      for (const command of javaScriptCommands) {
        this.eagerCustomCommands.set(command.name, command);
      }
    }

    for (const customCommand of normalizedOptions.customCommands ?? []) {
      if (isLazyCommand(customCommand)) {
        this.lazyCustomCommands.set(customCommand.name, customCommand);
      } else {
        this.eagerCustomCommands.set(customCommand.name, customCommand);
      }
    }

    if (this.useDefaultLayout) {
      this.installDefaultBinStubs();
    }

    for (const filePath of Object.keys(this.files)) {
      this.addParentDirs(filePath);
    }
    this.syncFs = this.createFsApi();
    this.fs = this.createPublicFsApi();
  }

  registerCommand(command: Command): void {
    this.eagerCustomCommands.set(command.name, command);
    this.lazyCustomCommands.delete(command.name);
  }

  private normalizePath(inputPath: string): string {
    if (inputPath.startsWith("/")) {
      return inputPath;
    }
    const cwd = this.getCwd();
    if (cwd === "/") {
      return `/${inputPath}`;
    }
    return `${cwd}/${inputPath}`;
  }

  private addParentDirs(filePath: string): void {
    if (!filePath.startsWith("/")) return;
    const parts = filePath.split("/").filter(Boolean);
    let current = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      current += `/${parts[i]}`;
      this.dirs[current] = "1";
    }
  }

  private createJavaScriptRuntimeCommands(config: true | JavaScriptConfig): Command[] {
    const javaScriptConfig = config === true ? {} : config;
    const runJavaScript = (args: string[], ctx: CommandContext) =>
      this.executeJavaScriptCommand(args, ctx, javaScriptConfig);

    return [
      defineCommand("js-exec", runJavaScript),
      defineCommand("node", async () => ({
        stdout: "",
        stderr: `node: this sandbox uses js-exec instead of node\n\n${JS_EXEC_HELP}`,
        exitCode: 1,
      })),
    ];
  }

  private async executeJavaScriptCommand(
    args: string[],
    ctx: CommandContext,
    config: JavaScriptConfig,
  ): Promise<ExecResult> {
    const parsed = this.parseJavaScriptArgs(args, ctx);
    if ("result" in parsed) {
      return parsed.result;
    }

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let exitCode = 0;
    const appendLine = (chunks: string[], values: unknown[]): void => {
      chunks.push(`${values.map(formatJavaScriptConsoleValue).join(" ")}\n`);
    };
    const sandbox: Record<string, unknown> = {};
    const processObject = {
      argv: parsed.argv,
      env: Object.fromEntries(ctx.env),
      cwd: () => ctx.cwd,
      exit: (code = 0): never => {
        exitCode = Number.isFinite(Number(code)) ? Number(code) : 0;
        throw new JavaScriptProcessExit(exitCode);
      },
      platform: "linux",
      arch: "x64",
      version: "v22.0.0",
      versions: { node: "22.0.0" },
    };
    sandbox.globalThis = sandbox;
    sandbox.console = {
      log: (...values: unknown[]) => appendLine(stdoutChunks, values),
      error: (...values: unknown[]) => appendLine(stderrChunks, values),
      warn: (...values: unknown[]) => appendLine(stderrChunks, values),
    };
    sandbox.process = processObject;
    sandbox.Buffer = globalThis.Buffer;
    sandbox.URL = globalThis.URL;
    sandbox.URLSearchParams = globalThis.URLSearchParams;
    sandbox.require = this.createJavaScriptRequire(ctx);
    if (config.invokeTool) {
      sandbox.tools = createJavaScriptToolsProxy(config.invokeTool);
    }
    try {
      const vm = await this.importNodeVm();
      const context = vm.createContext(sandbox);
      if (config.bootstrap) {
        const bootstrapScript = new vm.Script(config.bootstrap, { filename: "bootstrap.js" });
        const bootstrapResult = bootstrapScript.runInContext(context);
        if (isPromiseLike<void>(bootstrapResult)) {
          await bootstrapResult;
        }
      }
      const script = new vm.Script(`(async () => {\n${parsed.code}\n})()`, { filename: parsed.filename });
      const result = script.runInContext(context);
      if (isPromiseLike<void>(result)) {
        await result;
      }
    } catch (error) {
      if (!(error instanceof JavaScriptProcessExit)) {
        return {
          stdout: stdoutChunks.join(""),
          stderr: `${toErrorMessage(error)}\n`,
          exitCode: 1,
        };
      }
    }

    return {
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
      exitCode,
    };
  }

  private parseJavaScriptArgs(
    args: string[],
    ctx: CommandContext,
  ): JavaScriptParsedArgs | { result: ExecResult } {
    const rest = [...args];
    let inlineCode: string | undefined;
    let scriptPath: string | undefined;
    while (rest.length > 0) {
      const arg = rest.shift() ?? "";
      if (arg === "--help") {
        return { result: { stdout: JS_EXEC_HELP, stderr: "", exitCode: 0 } };
      }
      if (arg === "--version" || arg === "-V") {
        return { result: { stdout: "QuickJS (quickjs-emscripten)\n", stderr: "", exitCode: 0 } };
      }
      if (arg === "-m" || arg === "--module" || arg === "--strip-types") {
        continue;
      }
      if (arg === "-c") {
        inlineCode = rest.shift();
        if (inlineCode === undefined) {
          return { result: { stdout: "", stderr: "js-exec: option requires an argument -- 'c'\n", exitCode: 2 } };
        }
        break;
      }
      if (arg === "--") {
        if (rest.length > 0) {
          scriptPath = rest.shift();
        }
        break;
      }
      if (arg.startsWith("-") && arg !== "-") {
        return { result: { stdout: "", stderr: `js-exec: unrecognized option '${arg}'\n`, exitCode: 2 } };
      }
      scriptPath = arg;
      break;
    }

    if (inlineCode !== undefined) {
      return { code: inlineCode, filename: "-c", argv: ["js-exec", ...rest] };
    }
    if (scriptPath) {
      try {
        const resolvedPath = ctx.fs.exists(scriptPath)
          ? scriptPath
          : this.normalizePath(scriptPath);
        return {
          code: ctx.fs.readFile(resolvedPath),
          filename: resolvedPath,
          argv: [resolvedPath, ...rest],
        };
      } catch (error) {
        return { result: { stdout: "", stderr: `js-exec: can't open file '${scriptPath}': ${toErrorMessage(error)}\n`, exitCode: 2 } };
      }
    }

    const stdinCode = decodeBytesToUtf8(ctx.stdin);
    if (stdinCode.trim().length > 0) {
      return { code: stdinCode, filename: "<stdin>", argv: ["<stdin>"] };
    }
    return { result: { stdout: "", stderr: "js-exec: no input provided (use -c CODE or provide a script file)\n", exitCode: 2 } };
  }

  private createJavaScriptPathModule(ctx: CommandContext): JavaScriptPathModule {
    const pathModule: JavaScriptPathModule = {
      sep: "/" as const,
      delimiter: ":" as const,
      posix: undefined as unknown as JavaScriptPathModule,
      join: (...parts: string[]): string => {
        for (const part of parts) {
          if (typeof part !== "string") {
            throw new TypeError("Path must be a string");
          }
        }
        if (parts.length === 0) {
          return ".";
        }
        const joined = parts.filter((part) => part.length > 0).join("/");
        return joined.length === 0 ? "." : normalizeModulePath(joined);
      },
      resolve: (...parts: string[]): string => {
        for (const part of parts) {
          if (typeof part !== "string") {
            throw new TypeError("Path must be a string");
          }
        }
        for (let index = parts.length - 1; index >= 0; index -= 1) {
          const part = parts[index];
          if (part.length === 0) {
            continue;
          }
          if (part.startsWith("/")) {
            return normalizePosixPath([part, ...parts.slice(index + 1)].join("/"));
          }
        }
        return normalizePosixPath(parts.filter((part) => part.length > 0).join("/"), ctx.cwd);
      },
      normalize: normalizeModulePath,
      isAbsolute: (path: string): boolean => path.startsWith("/"),
      dirname: dirnamePosixPath,
      basename: basenamePosixPath,
      extname: extnamePosixPath,
      relative: relativePosixPath,
      parse: (path: string) => {
        const root = path.startsWith("/") ? "/" : "";
        const dir = dirnamePosixPath(path);
        const base = basenamePosixPath(path);
        const ext = extnamePosixPath(path);
        const name = ext ? base.slice(0, -ext.length) : base;
        return { root, dir, base, ext, name };
      },
      format: (pathObject: { root?: string; dir?: string; base?: string; name?: string; ext?: string }): string => {
        const dir = pathObject.dir ?? pathObject.root ?? "";
        const base = pathObject.base ?? `${pathObject.name ?? ""}${pathObject.ext ?? ""}`;
        if (!dir) {
          return base;
        }
        if (dir === "/") {
          return `/${base}`;
        }
        return `${dir}/${base}`;
      },
    };
    pathModule.posix = pathModule;
    return pathModule;
  }

  private createJavaScriptFsModule(ctx: CommandContext): Record<string, unknown> {
    const resolvePath = (path: string): string => normalizePosixPath(path, ctx.cwd);
    const readFileBuffer = (path: string): Uint8Array =>
      TEXT_ENCODER.encode(ctx.fs.readFile(resolvePath(path)));
    const readFileSync = (path: string, options?: string | { encoding?: string }): string | Uint8Array => {
      const encoding = typeof options === "string" ? options : options?.encoding;
      const resolved = resolvePath(path);
      if (encoding) {
        return ctx.fs.readFile(resolved);
      }
      const bytes = readFileBuffer(resolved);
      return typeof Buffer !== "undefined" ? Buffer.from(bytes) : bytes;
    };
    const writeFileSync = (path: string, content: unknown): void => {
      const text = content instanceof Uint8Array
        ? TEXT_DECODER.decode(content)
        : typeof Buffer !== "undefined" && Buffer.isBuffer(content)
          ? content.toString()
          : String(content);
      ctx.fs.writeFile(resolvePath(path), text);
    };
    const mkdirSync = (path: string, options?: { recursive?: boolean }): void => {
      ctx.fs.mkdir(resolvePath(path), options);
    };
    const rmSync = (path: string, options?: { recursive?: boolean; force?: boolean }): void => {
      ctx.fs.rm(resolvePath(path), options);
    };
    const statSync = (path: string) => {
      const stat = ctx.fs.stat(resolvePath(path));
      return {
        ...stat,
        isSymbolicLink: (): boolean => stat.isSymlink,
        isFile: (): boolean => stat.isFile,
        isDirectory: (): boolean => stat.isDirectory,
      };
    };
    const existsSync = (path: string): boolean => ctx.fs.exists(resolvePath(path));
    const readdirSync = (path: string): string[] =>
      ctx.fs.readdir(resolvePath(path)).map((entry) => entry.name);

    return {
      readFileSync,
      readFileBuffer,
      writeFileSync,
      statSync,
      lstatSync: statSync,
      readdirSync,
      mkdirSync,
      rmSync,
      unlinkSync: (path: string): void => rmSync(path),
      rmdirSync: (path: string): void => rmSync(path),
      existsSync,
      appendFileSync: (path: string, content: unknown): void => {
        ctx.fs.appendFile(resolvePath(path), String(content));
      },
      readFile: (): never => {
        throw new Error("fs.readFile() with callbacks is not supported. Use fs.readFileSync() or fs.promises.readFile() instead.");
      },
      writeFile: (): never => {
        throw new Error("fs.writeFile() with callbacks is not supported. Use fs.writeFileSync() or fs.promises.writeFile() instead.");
      },
      promises: {
        readFile: async (path: string, options?: string | { encoding?: string }) => readFileSync(path, options),
        writeFile: async (path: string, content: unknown) => writeFileSync(path, content),
        readdir: async (path: string) => readdirSync(path),
        stat: async (path: string) => statSync(path),
        lstat: async (path: string) => statSync(path),
        mkdir: async (path: string, options?: { recursive?: boolean }) => mkdirSync(path, options),
        rm: async (path: string, options?: { recursive?: boolean; force?: boolean }) => rmSync(path, options),
        unlink: async (path: string) => rmSync(path),
        rmdir: async (path: string) => rmSync(path),
        access: async (path: string) => {
          if (!existsSync(path)) {
            throw new Error(`ENOENT: no such file or directory: ${path}`);
          }
        },
      },
    };
  }

  private createJavaScriptRequire(ctx: CommandContext): JavaScriptRequire {
    const pathModule = this.createJavaScriptPathModule(ctx);
    const fsModule = this.createJavaScriptFsModule(ctx);
    const processModule = {
      argv: ["js-exec"],
      cwd: () => ctx.cwd,
      env: Object.fromEntries(ctx.env),
      platform: "linux",
      arch: "x64",
      version: "v22.0.0",
      versions: { node: "22.0.0" },
    };
    const modules: Record<string, unknown> = {
      fs: fsModule,
      path: pathModule,
      process: processModule,
      buffer: { Buffer: globalThis.Buffer },
    };
    const requireFn = ((rawName: string): unknown => {
      const name = rawName.startsWith("node:") ? rawName.slice(5) : rawName;
      if (Object.prototype.hasOwnProperty.call(modules, name)) {
        return modules[name];
      }
      throw new Error(`Cannot find module '${name}'. Run 'js-exec --help' for available modules.`);
    }) as JavaScriptRequire;
    requireFn.resolve = (name: string): string => name;
    return requireFn;
  }

  private async importNodeVm(): Promise<typeof import("node:vm")> {
    if (!this.isNodeRuntime()) {
      throw new Error("js-exec: JavaScript runtime is not available in this environment");
    }
    return (await this.invokeDynamicImport("node:vm")) as typeof import("node:vm");
  }

  private installDefaultBinStubs(): void {
    const executableMode = (0o755).toString();
    for (const commandName of this.getRegisteredCommandNamesForLayout()) {
      const stubPath = `/bin/${commandName}`;
      if (!Object.prototype.hasOwnProperty.call(this.files, stubPath)) {
        this.files[stubPath] = `${DEFAULT_BIN_STUB_PREFIX}${commandName}\n`;
      }
      if (!Object.prototype.hasOwnProperty.call(this.modes, stubPath)) {
        this.modes[stubPath] = executableMode;
      }
    }
  }

  private getRegisteredCommandNamesForLayout(): string[] {
    const names = new Set<string>(getCommandNames());
    for (const name of INTERNAL_SHELL_COMMAND_NAMES) names.add(name);
    if (this.options.fetch || this.options.network) {
      for (const name of getNetworkCommandNames()) names.add(name);
    }
    if (this.options.python) {
      for (const name of getPythonCommandNames()) names.add(name);
    }
    if (this.options.javascript) {
      for (const name of getJavaScriptCommandNames()) names.add(name);
    }
    for (const name of this.eagerCustomCommands.keys()) names.add(name);
    for (const name of this.lazyCustomCommands.keys()) names.add(name);
    return [...names];
  }

  private createFsApi(): FileSystem {
    return {
      readFile: (path: string): string => {
        const normalized = this.normalizePath(path);
        if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
          return this.files[normalized];
        }
        throw new Error(`No such file: ${normalized}`);
      },
      writeFile: (path: string, content: string): void => {
        const normalized = this.normalizePath(path);
        this.files[normalized] = content;
        this.modes[normalized] = this.modes[normalized] ?? (0o644).toString();
        this.addParentDirs(normalized);
      },
      appendFile: (path: string, content: string): void => {
        const normalized = this.normalizePath(path);
        const existing = this.files[normalized] ?? "";
        this.files[normalized] = existing + content;
        this.modes[normalized] = this.modes[normalized] ?? (0o644).toString();
        this.addParentDirs(normalized);
      },
      exists: (path: string): boolean => {
        const normalized = this.normalizePath(path);
        return (
          Object.prototype.hasOwnProperty.call(this.files, normalized) ||
          Object.prototype.hasOwnProperty.call(this.dirs, normalized) ||
          Object.prototype.hasOwnProperty.call(this.links, normalized)
        );
      },
      stat: (path: string) => {
        const normalized = this.normalizePath(path);
        if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
          return {
            isFile: true,
            isDirectory: false,
            isSymlink: false,
            size: this.files[normalized].length,
            mode: Number.parseInt(this.modes[normalized] ?? "420", 10),
            mtime: 0,
          };
        }
        if (Object.prototype.hasOwnProperty.call(this.dirs, normalized)) {
          return {
            isFile: false,
            isDirectory: true,
            isSymlink: false,
            size: 0,
            mode: Number.parseInt(this.modes[normalized] ?? "493", 10),
            mtime: 0,
          };
        }
        if (Object.prototype.hasOwnProperty.call(this.links, normalized)) {
          return {
            isFile: false,
            isDirectory: false,
            isSymlink: true,
            size: this.links[normalized].length,
            mode: Number.parseInt(this.modes[normalized] ?? "511", 10),
            mtime: 0,
          };
        }
        throw new Error(`No such file: ${normalized}`);
      },
      readdir: (path: string) => {
        const normalized = this.normalizePath(path);
        const prefix = normalized === "/" ? "/" : `${normalized}/`;
        const names = new Set<string>();
        const collect = (candidatePath: string): void => {
          if (!candidatePath.startsWith(prefix)) {
            return;
          }
          const rest = candidatePath.slice(prefix.length);
          if (rest.length === 0) {
            return;
          }
          const slash = rest.indexOf("/");
          const name = slash === -1 ? rest : rest.slice(0, slash);
          if (name.length > 0) {
            names.add(name);
          }
        };
        for (const key of Object.keys(this.files)) {
          collect(key);
        }
        for (const key of Object.keys(this.dirs)) {
          collect(key);
        }
        for (const key of Object.keys(this.links)) {
          collect(key);
        }
        return [...names].sort().map((name) => {
          const child = normalized === "/" ? `/${name}` : `${normalized}/${name}`;
          const type = Object.prototype.hasOwnProperty.call(this.dirs, child)
            ? "directory"
            : Object.prototype.hasOwnProperty.call(this.links, child)
              ? "symlink"
              : "file";
          return { name, type } as const;
        });
      },
      mkdir: (path: string, options?: { recursive?: boolean }): void => {
        const normalized = this.normalizePath(path);
        if (options?.recursive) {
          const parts = normalized.split("/").filter(Boolean);
          let current = "";
          for (const part of parts) {
            current += `/${part}`;
            this.dirs[current] = "1";
            this.modes[current] = this.modes[current] ?? (0o755).toString();
          }
          return;
        }
        this.dirs[normalized] = "1";
        this.modes[normalized] = this.modes[normalized] ?? (0o755).toString();
      },
      rm: (path: string, options?: { recursive?: boolean; force?: boolean }): void => {
        const normalized = this.normalizePath(path);
        const removeEntry = (targetPath: string): void => {
          delete this.files[targetPath];
          delete this.links[targetPath];
          delete this.dirs[targetPath];
          delete this.modes[targetPath];
        };
        if (options?.recursive) {
          for (const key of Object.keys(this.files)) {
            if (key === normalized || key.startsWith(`${normalized}/`)) {
              removeEntry(key);
            }
          }
          for (const key of Object.keys(this.links)) {
            if (key === normalized || key.startsWith(`${normalized}/`)) {
              removeEntry(key);
            }
          }
          for (const key of Object.keys(this.dirs)) {
            if (key === normalized || key.startsWith(`${normalized}/`)) {
              removeEntry(key);
            }
          }
          return;
        }
        if (
          !Object.prototype.hasOwnProperty.call(this.files, normalized) &&
          !Object.prototype.hasOwnProperty.call(this.links, normalized) &&
          !Object.prototype.hasOwnProperty.call(this.dirs, normalized) &&
          !options?.force
        ) {
          throw new Error(`No such file: ${normalized}`);
        }
        removeEntry(normalized);
      },
      cp: (src: string, dst: string): void => {
        const srcPath = this.normalizePath(src);
        const dstPath = this.normalizePath(dst);
        if (!Object.prototype.hasOwnProperty.call(this.files, srcPath)) {
          throw new Error(`No such file: ${srcPath}`);
        }
        this.files[dstPath] = this.files[srcPath];
        this.modes[dstPath] = this.modes[srcPath] ?? (0o644).toString();
        this.addParentDirs(dstPath);
      },
      mv: (src: string, dst: string): void => {
        const srcPath = this.normalizePath(src);
        const dstPath = this.normalizePath(dst);
        if (!Object.prototype.hasOwnProperty.call(this.files, srcPath)) {
          throw new Error(`No such file: ${srcPath}`);
        }
        this.files[dstPath] = this.files[srcPath];
        this.modes[dstPath] = this.modes[srcPath] ?? (0o644).toString();
        delete this.files[srcPath];
        delete this.modes[srcPath];
        this.addParentDirs(dstPath);
      },
      chmod: (path: string, mode: number): void => {
        const normalized = this.normalizePath(path);
        this.modes[normalized] = Math.floor(mode).toString();
      },
    };
  }

  private createPublicFsApi(): IFileSystem {
    const toFsStat = (stat: ReturnType<FileSystem["stat"]>): FsStat => ({
      isFile: stat.isFile,
      isDirectory: stat.isDirectory,
      isSymbolicLink: stat.isSymlink,
      mode: stat.mode,
      size: stat.size,
      mtime: new Date(stat.mtime),
    });
    const binaryStringToBytes = (content: string): Uint8Array => {
      const bytes = new Uint8Array(content.length);
      for (let i = 0; i < content.length; i += 1) {
        bytes[i] = content.charCodeAt(i) & 0xff;
      }
      return bytes;
    };
    const toBytes = (
      content: FileContent,
      options?: WriteFileOptions | BufferEncoding,
    ): Uint8Array => {
      const encoding = typeof options === "string" ? options : options?.encoding;
      if (content instanceof Uint8Array) {
        return content;
      }
      if (encoding === "binary" || encoding === "latin1") {
        return binaryStringToBytes(content);
      }
      if (encoding === "base64") {
        const binary = typeof Buffer !== "undefined"
          ? Buffer.from(content, "base64").toString("binary")
          : atob(content);
        return binaryStringToBytes(binary);
      }
      return TEXT_ENCODER.encode(content);
    };
    const isBinaryWrite = (
      content: FileContent,
      options?: WriteFileOptions | BufferEncoding,
    ): boolean => {
      const encoding = typeof options === "string" ? options : options?.encoding;
      return content instanceof Uint8Array || encoding === "binary" || encoding === "latin1";
    };
    const decodeBytes = (
      bytes: Uint8Array,
      options?: ReadFileOptions | BufferEncoding,
    ): string => {
      const encoding = typeof options === "string" ? options : options?.encoding;
      if (encoding === "binary" || encoding === "latin1") {
        return latin1FromBytes(bytesFromUint8Array(bytes));
      }
      if (encoding === "base64") {
        const binary = latin1FromBytes(bytesFromUint8Array(bytes));
        return typeof Buffer !== "undefined"
          ? Buffer.from(binary, "binary").toString("base64")
          : btoa(binary);
      }
      return TEXT_DECODER.decode(bytes);
    };
    const bytesForPath = (path: string): Uint8Array => {
      const normalized = this.normalizePath(path);
      const content = this.syncFs.readFile(path);
      return this.binaryFsPaths.has(normalized)
        ? uint8ArrayFromBytes(unsafeBytesFromLatin1(content))
        : TEXT_ENCODER.encode(content);
    };

    return {
      readFile: async (path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> =>
        decodeBytes(await this.fs.readFileBuffer(path), options),
      readFileBytes: async (path: string): Promise<ByteString> =>
        bytesFromUint8Array(await this.fs.readFileBuffer(path)),
      readFileBuffer: async (path: string): Promise<Uint8Array> => {
        return bytesForPath(path);
      },
      writeFile: async (
        path: string,
        content: FileContent,
        options?: WriteFileOptions | BufferEncoding,
      ): Promise<void> => {
        const normalized = this.normalizePath(path);
        this.syncFs.writeFile(path, latin1FromBytes(bytesFromUint8Array(toBytes(content, options))));
        if (isBinaryWrite(content, options)) {
          this.binaryFsPaths.add(normalized);
        } else {
          this.binaryFsPaths.delete(normalized);
        }
      },
      appendFile: async (
        path: string,
        content: FileContent,
        options?: WriteFileOptions | BufferEncoding,
      ): Promise<void> => {
        const normalized = this.normalizePath(path);
        this.syncFs.appendFile(path, latin1FromBytes(bytesFromUint8Array(toBytes(content, options))));
        if (isBinaryWrite(content, options)) {
          this.binaryFsPaths.add(normalized);
        }
      },
      exists: async (path: string): Promise<boolean> => this.syncFs.exists(path),
      stat: async (path: string): Promise<FsStat> => toFsStat(this.syncFs.stat(path)),
      mkdir: async (path: string, options?: MkdirOptions): Promise<void> => {
        this.syncFs.mkdir(path, options);
      },
      readdir: async (path: string): Promise<string[]> =>
        this.syncFs.readdir(path).map((entry) => entry.name),
      readdirWithFileTypes: async (path: string): Promise<AsyncDirentEntry[]> =>
        this.syncFs.readdir(path).map((entry) => ({
          name: entry.name,
          isFile: entry.type === "file",
          isDirectory: entry.type === "directory",
          isSymbolicLink: entry.type === "symlink",
        })),
      rm: async (path: string, options?: RmOptions): Promise<void> => {
        this.syncFs.rm(path, options);
      },
      cp: async (src: string, dest: string, options?: CpOptions): Promise<void> => {
        this.syncFs.cp(src, dest, options);
      },
      mv: async (src: string, dest: string): Promise<void> => {
        this.syncFs.mv(src, dest);
      },
      resolvePath: (base: string, path: string): string => normalizePosixPath(path, base),
      getAllPaths: (): string[] =>
        [...new Set([
          ...Object.keys(this.files),
          ...Object.keys(this.dirs),
          ...Object.keys(this.links),
        ])].sort(),
      chmod: async (path: string, mode: number): Promise<void> => {
        this.syncFs.chmod(path, mode);
      },
      symlink: async (target: string, linkPath: string): Promise<void> => {
        const normalized = this.normalizePath(linkPath);
        this.links[normalized] = target;
        this.modes[normalized] = this.modes[normalized] ?? (0o777).toString();
        this.addParentDirs(normalized);
      },
      link: async (existingPath: string, newPath: string): Promise<void> => {
        this.syncFs.cp(existingPath, newPath);
      },
      readlink: async (path: string): Promise<string> => {
        const normalized = this.normalizePath(path);
        if (!Object.prototype.hasOwnProperty.call(this.links, normalized)) {
          throw new Error(`No such file: ${normalized}`);
        }
        return this.links[normalized];
      },
      lstat: async (path: string): Promise<FsStat> => toFsStat(this.syncFs.stat(path)),
      realpath: async (path: string): Promise<string> => this.normalizePath(path),
      utimes: async (path: string, _atime: Date, mtime: Date): Promise<void> => {
        const normalized = this.normalizePath(path);
        if (!this.syncFs.exists(normalized)) {
          throw new Error(`No such file: ${normalized}`);
        }
        this.modes[`${normalized}:mtime`] = String(mtime.getTime());
      },
    };
  }

  private extractFsSnapshot(fsLike: unknown): InitialFiles | undefined {
    if (!fsLike || typeof fsLike !== "object") {
      return undefined;
    }
    const maybeSnapshot = fsLike as {
      __moon_bash_snapshot?: () => unknown;
    };
    if (typeof maybeSnapshot.__moon_bash_snapshot !== "function") {
      return undefined;
    }
    const raw = maybeSnapshot.__moon_bash_snapshot();
    if (!raw || typeof raw !== "object") {
      return undefined;
    }

    const out: InitialFiles = {};
    for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" || value instanceof Uint8Array) {
        out[path] = value;
      } else if (value === null || value === undefined) {
        out[path] = "";
      } else if (typeof value === "object") {
        out[path] = value as InitialFileEntry;
      } else if (
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "symbol"
      ) {
        out[path] = stringifyPrimitive(value);
      } else {
        out[path] = "";
      }
    }
    return out;
  }

  private extractFsApplyState(
    fsLike: unknown,
  ): ((
    files: Record<string, string>,
    dirs?: Record<string, string>,
    links?: Record<string, string>,
    modes?: Record<string, string>,
  ) => void) | null {
    if (!fsLike || typeof fsLike !== "object") {
      return null;
    }
    const maybeStateful = fsLike as {
      __moon_bash_apply_state?: (
        files: Record<string, string>,
        dirs?: Record<string, string>,
        links?: Record<string, string>,
        modes?: Record<string, string>,
      ) => void;
    };
    if (typeof maybeStateful.__moon_bash_apply_state !== "function") {
      return null;
    }
    return maybeStateful.__moon_bash_apply_state.bind(fsLike);
  }

  private normalizeInitialFiles(files?: InitialFiles): {
    files: Record<string, string>;
    modes: Record<string, string>;
  } {
    const normalizedFiles: Record<string, string> = {};
    const normalizedModes: Record<string, string> = {};
    if (!files || typeof files !== "object") {
      return { files: normalizedFiles, modes: normalizedModes };
    }

    for (const [rawPath, rawValue] of Object.entries(files)) {
      const path = this.normalizePath(rawPath);
      const parsed = this.normalizeInitialFileValue(rawValue);
      normalizedFiles[path] = parsed.content;
      if (parsed.mode !== null) {
        normalizedModes[path] = parsed.mode.toString();
      }
    }

    return { files: normalizedFiles, modes: normalizedModes };
  }

  private normalizeInitialFileValue(value: InitialFileValue): {
    content: string;
    mode: number | null;
  } {
    if (typeof value === "string") {
      return { content: value, mode: null };
    }

    if (value instanceof Uint8Array) {
      return { content: this.decodeInitialFileBytes(value), mode: null };
    }

    if (value && typeof value === "object") {
      const entry = value as { content?: unknown; mode?: unknown };
      return {
        content: this.normalizeInitialFileContent(entry.content),
        mode: this.normalizeInitialFileMode(entry.mode),
      };
    }

    return { content: "", mode: null };
  }

  private normalizeInitialFileContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }
    if (content instanceof Uint8Array) {
      return this.decodeInitialFileBytes(content);
    }
    if (content === null || content === undefined) {
      return "";
    }
    if (
      typeof content === "boolean" ||
      typeof content === "number" ||
      typeof content === "bigint" ||
      typeof content === "symbol"
    ) {
      return stringifyPrimitive(content);
    }
    return "";
  }

  private decodeInitialFileBytes(bytes: Uint8Array): string {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(bytes);
    }
    let out = "";
    for (const byte of bytes) {
      out += String.fromCharCode(byte);
    }
    return out;
  }

  private normalizeInitialFileMode(mode: unknown): number | null {
    if (typeof mode === "number") {
      if (!Number.isFinite(mode) || mode < 0) {
        return null;
      }
      return Math.floor(mode);
    }
    if (typeof mode !== "string") {
      return null;
    }
    const trimmed = mode.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (/^0[oO][0-7]+$/.test(trimmed)) {
      return parseInt(trimmed.slice(2), 8);
    }
    if (/^[0-7]{3,4}$/.test(trimmed)) {
      return parseInt(trimmed, 8);
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.floor(parsed);
  }

  private applyState(result: StateExecResult): void {
    if (result.files && typeof result.files === "object") {
      this.files = result.files;
    }
    if (result.dirs && typeof result.dirs === "object") {
      this.dirs = result.dirs;
    }
    if (result.links && typeof result.links === "object") {
      this.links = result.links;
    }
    if (result.modes && typeof result.modes === "object") {
      this.modes = result.modes;
    }
    this.externalFsApplyState?.(this.files, this.dirs, this.links, this.modes);
  }

  private normalizeFetchResponse(response: MoonBashFetchResponse): MoonBashFetchResponse {
    return {
      ok: Boolean(response.ok),
      status: Number.isFinite(response.status) ? response.status : 0,
      statusText: response.statusText ?? "",
      headers: response.headers ?? {},
      body: response.body ?? "",
      error: response.error,
    };
  }

  private normalizeVmResponse(response: MoonBashVmResponse): MoonBashVmResponse {
    return {
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
      exitCode: Number.isFinite(response.exitCode) ? Math.floor(response.exitCode) : 1,
      error: response.error,
      files: response.files && typeof response.files === "object" ? response.files : undefined,
    };
  }

  private defaultNowMs(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      const value = performance.now();
      return Number.isFinite(value) ? Math.floor(value) : 0;
    }
    if (typeof Date !== "undefined" && typeof Date.now === "function") {
      const value = Date.now();
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.floor(value % 2147483647);
    }
    return 0;
  }

  private defaultWallNowMs(): number {
    if (typeof Date !== "undefined" && typeof Date.now === "function") {
      const value = Date.now();
      return Number.isFinite(value) ? Math.floor(value) : 0;
    }
    return 0;
  }

  private defaultSleep(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return;
    }
    const waitMs = Math.floor(durationMs);

    if (
      typeof SharedArrayBuffer !== "undefined" &&
      typeof Atomics !== "undefined" &&
      typeof setTimeout === "function"
    ) {
      waitForPromise(
        new Promise<void>((resolve) => {
          setTimeout(resolve, waitMs);
        }),
      );
      return;
    }

    const start = this.defaultNowMs();
    while (this.defaultNowMs() - start < waitMs) {
      // Busy-wait fallback for runtimes without Atomics.wait support.
    }
  }

  private defaultFetch(request: MoonBashFetchRequest): Promise<MoonBashFetchResponse> {
    if (typeof fetch !== "function") {
      return Promise.resolve({
        ok: false,
        status: 0,
        statusText: "",
        headers: {},
        body: "",
        error: "global fetch is not available in this runtime",
      });
    }
    const init: RequestInit = {
      method: request.method || "GET",
      headers: request.headers,
      body: request.body,
    };
    return fetch(request.url, init).then(async (response) => {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body: await response.text(),
      };
    });
  }

  private createFetchBridge(): MoonBashFetchBridge | undefined {
    const networkOptions = this.options.network;
    if (!networkOptions) {
      return undefined;
    }

    const legacyFetch = "fetch" in networkOptions ? networkOptions.fetch : undefined;
    const fetchImpl = legacyFetch
      ? legacyFetch
      : (request: MoonBashFetchRequest) => this.defaultFetch(request);

    return (requestJson: string): string => {
      try {
        const request = JSON.parse(requestJson) as MoonBashFetchRequest;
        const maybeResponse = fetchImpl(request);
        const response = isPromiseLike<MoonBashFetchResponse>(maybeResponse)
          ? waitForPromise(Promise.resolve(maybeResponse))
          : maybeResponse;

        return JSON.stringify(this.normalizeFetchResponse(response));
      } catch (error) {
        return JSON.stringify({
          ok: false,
          status: 0,
          statusText: "",
          headers: {},
          body: "",
          error: toErrorMessage(error),
        } satisfies MoonBashFetchResponse);
      }
    };
  }

  private createSleepBridge(): MoonBashSleepBridge {
    const sleepImpl = this.options.timers?.sleep
      ? this.options.timers.sleep
      : (durationMs: number) => this.defaultSleep(durationMs);

    return (durationMs: number): string => {
      try {
        const waitMs = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0;
        const maybeResult = sleepImpl(waitMs);
        if (isPromiseLike<void>(maybeResult)) {
          // Keep host event-loop responsive for mocked async clocks in tests.
          Promise.resolve(maybeResult).catch(() => {});
        }
        return "";
      } catch (error) {
        return toErrorMessage(error);
      }
    };
  }

  private createNowBridge(): MoonBashNowBridge {
    const nowImpl = this.options.timers?.now;
    if (!nowImpl) {
      return () => this.defaultNowMs();
    }
    return (): number => {
      try {
        const value = nowImpl();
        if (!Number.isFinite(value)) {
          return 0;
        }
        if (value < 0) {
          return 0;
        }
        return Math.floor(value) % 2147483647;
      } catch {
        return 0;
      }
    };
  }

  private createWallNowBridge(): MoonBashWallNowBridge {
    const wallNowImpl = this.options.timers?.wallNow;
    if (!wallNowImpl) {
      return () => this.defaultWallNowMs();
    }
    return (): number => {
      try {
        const value = wallNowImpl();
        if (!Number.isFinite(value)) {
          return 0;
        }
        return Math.floor(value);
      } catch {
        return 0;
      }
    };
  }

  private getLogger(): BashLogger | undefined {
    const logger = this.options.logger;
    if (!logger || typeof logger.info !== "function" || typeof logger.debug !== "function") {
      return undefined;
    }
    return logger;
  }

  private getCoverageWriter(): FeatureCoverageWriter | undefined {
    const writer = this.options.coverage;
    if (!writer || typeof writer.hit !== "function") {
      return undefined;
    }
    return writer;
  }

  private recordCoverage(script: string): void {
    const writer = this.getCoverageWriter();
    if (!writer) {
      return;
    }

    // Baseline features to keep fuzz coverage telemetry usable.
    writer.hit("bash:cmd:SimpleCommand");
    writer.hit("bash:cmd:If");
    writer.hit("bash:cmd:For");
    writer.hit("bash:cmd:While");
    writer.hit("bash:builtin:export");

    // Lightweight heuristics for additional signal.
    if (script.includes("awk")) writer.hit("awk:stmt:print");
    if (script.includes("sed")) writer.hit("sed:cmd:substitute");
    if (script.includes("jq")) writer.hit("jq:node:Call");
    if (script.includes("$")) writer.hit("bash:expansion:default_value");
    if (script.includes("-n")) writer.hit("cmd:flag:echo:-n");
  }

  private getExecutionLimits(): Partial<ExecutionLimits> {
    return {
      ...this.options.limits,
      ...this.options.executionLimits,
      ...(this.options.maxCallDepth !== undefined ? { maxCallDepth: this.options.maxCallDepth } : {}),
      ...(this.options.maxCommandCount !== undefined ? { maxCommandCount: this.options.maxCommandCount } : {}),
      ...(this.options.maxLoopIterations !== undefined ? { maxLoopIterations: this.options.maxLoopIterations } : {}),
    };
  }

  private createVirtualProcessEnv(processInfo: BashOptions["processInfo"]): Record<string, string> {
    const env: Record<string, string> = {
      __MOON_BASH_PID: "1",
      __MOON_BASH_PPID: "0",
      __MOON_BASH_UID: "1000",
      __MOON_BASH_EUID: "1000",
    };
    const pid = this.normalizeProcessInfoNumber(processInfo?.pid);
    const ppid = this.normalizeProcessInfoNumber(processInfo?.ppid);
    const uid = this.normalizeProcessInfoNumber(processInfo?.uid);
    if (pid !== undefined) {
      env.__MOON_BASH_PID = pid;
    }
    if (ppid !== undefined) {
      env.__MOON_BASH_PPID = ppid;
    }
    if (uid !== undefined) {
      env.__MOON_BASH_UID = uid;
      env.__MOON_BASH_EUID = uid;
    }
    return env;
  }

  private normalizeProcessInfoNumber(value: unknown): string | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return Math.floor(value).toString();
  }

  private stripInternalEnv(env: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (!key.startsWith("__MOON_BASH_")) {
        out[key] = value;
      }
    }
    return out;
  }

  private encodeLimitsJson(): string {
    const limits = this.getExecutionLimits();
    const out: Record<string, string> = {};
    const set = (key: string, value: unknown): void => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return;
      }
      out[key] = Math.floor(value).toString();
    };
    set("max_call_depth", limits.maxCallDepth);
    set("max_command_count", limits.maxCommandCount);
    set("max_loop_iterations", limits.maxLoopIterations);
    set("max_string_length", limits.maxStringLength);
    set("max_array_elements", limits.maxArrayElements);
    set("max_heredoc_size", limits.maxHeredocSize);
    set("max_substitution_depth", limits.maxSubstitutionDepth);
    set("max_glob_operations", limits.maxGlobOperations);
    set("max_awk_iterations", limits.maxAwkIterations);
    set("max_sed_iterations", limits.maxSedIterations);
    set("max_jq_iterations", limits.maxJqIterations);
    return JSON.stringify(out);
  }

  private normalizeExecResult(result: BashExecResult): BashExecResult {
    if (result.exitCode === 126 && result.stderr.includes("too many commands executed")) {
      return { ...result, stdout: "" };
    }
    return result;
  }

  private hasCustomCommands(): boolean {
    return this.eagerCustomCommands.size > 0 || this.lazyCustomCommands.size > 0;
  }

  private async resolveCustomCommand(name: string): Promise<Command | undefined> {
    const eager = this.eagerCustomCommands.get(name);
    if (eager) {
      return eager;
    }
    const lazy = this.lazyCustomCommands.get(name);
    if (!lazy) {
      return undefined;
    }
    const loaded = await lazy.load();
    this.eagerCustomCommands.set(name, loaded);
    this.lazyCustomCommands.delete(name);
    return loaded;
  }

  private buildCustomPrelude(script: string): string {
    if (!this.hasCustomCommands()) {
      return script;
    }
    const names = new Set<string>();
    for (const name of this.eagerCustomCommands.keys()) {
      names.add(name);
    }
    for (const name of this.lazyCustomCommands.keys()) {
      names.add(name);
    }
    const lines: string[] = [];
    for (const name of names) {
      // Custom command names are sourced from trusted host code.
      lines.push(`function ${name} { __moon_bash_custom__ ${shellSingleQuote(name)} "$@"; }`);
    }
    if (lines.length === 0) {
      return script;
    }
    return `${lines.join("\n")}\n${script}`;
  }

  private createCustomBridge(
    limitsJson: string,
    layoutMode: "default" | "minimal",
  ): MoonBashCustomBridge | undefined {
    if (!this.hasCustomCommands()) {
      return undefined;
    }

    return (requestJson: string): string => {
      try {
        const request = JSON.parse(requestJson) as MoonBashCustomRequest;
        const maybeResponse = this.runCustomCommandBridge(request, limitsJson, layoutMode);
        const response = isPromiseLike<MoonBashCustomResponse>(maybeResponse)
          ? waitForPromise(Promise.resolve(maybeResponse))
          : maybeResponse;
        return JSON.stringify(this.normalizeCustomResponse(response));
      } catch (error) {
        return JSON.stringify({
          handled: false,
          stdout: "",
          stderr: "",
          exitCode: 1,
          error: toErrorMessage(error),
        } satisfies MoonBashCustomResponse);
      }
    };
  }

  private normalizeCustomResponse(response: MoonBashCustomResponse): MoonBashCustomResponse {
    return {
      handled: Boolean(response.handled),
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
      exitCode: Number.isFinite(response.exitCode) ? Math.floor(response.exitCode) : 1,
      error: response.error,
      files: response.files && typeof response.files === "object" ? response.files : undefined,
    };
  }

  private async runCustomCommandBridge(
    request: MoonBashCustomRequest,
    limitsJson: string,
    layoutMode: "default" | "minimal",
  ): Promise<MoonBashCustomResponse> {
    if (!request || typeof request.name !== "string") {
      return { handled: false, stdout: "", stderr: "", exitCode: 1 };
    }

    const customCommand = await this.resolveCustomCommand(request.name);
    if (!customCommand) {
      return { handled: false, stdout: "", stderr: "", exitCode: 127 };
    }

    const cwd = normalizePosixPath(request.cwd ?? "/");
    const envObject: Record<string, string> = { ...request.env };
    let filesState: Record<string, string> =
      request.files && typeof request.files === "object" ? request.files : {};
    let filesMutable = false;
    let filesDirty = false;
    const ensureMutableFilesState = (): void => {
      if (!filesMutable) {
        filesState = { ...filesState };
        filesMutable = true;
      }
      filesDirty = true;
    };

    const fsApi: FileSystem = {
      readFile: (path: string): string => {
        const normalized = normalizePosixPath(path, cwd);
        if (!Object.prototype.hasOwnProperty.call(filesState, normalized)) {
          throw new Error(`No such file: ${normalized}`);
        }
        return filesState[normalized];
      },
      writeFile: (path: string, content: string): void => {
        ensureMutableFilesState();
        const normalized = normalizePosixPath(path, cwd);
        filesState[normalized] = content;
      },
      appendFile: (path: string, content: string): void => {
        ensureMutableFilesState();
        const normalized = normalizePosixPath(path, cwd);
        filesState[normalized] = (filesState[normalized] ?? "") + content;
      },
      exists: (path: string): boolean => {
        const normalized = normalizePosixPath(path, cwd);
        if (Object.prototype.hasOwnProperty.call(filesState, normalized)) {
          return true;
        }
        const allPaths = Object.keys(filesState);
        return allPaths.some((candidate) => candidate.startsWith(`${normalized}/`));
      },
      stat: (path: string) => {
        const normalized = normalizePosixPath(path, cwd);
        if (Object.prototype.hasOwnProperty.call(filesState, normalized)) {
          return {
            isFile: true,
            isDirectory: false,
            isSymlink: false,
            size: filesState[normalized].length,
            mode: 0o644,
            mtime: 0,
          };
        }
        const allPaths = Object.keys(filesState);
        if (allPaths.some((candidate) => candidate.startsWith(`${normalized}/`))) {
          return {
            isFile: false,
            isDirectory: true,
            isSymlink: false,
            size: 0,
            mode: 0o755,
            mtime: 0,
          };
        }
        throw new Error(`No such file: ${normalized}`);
      },
      readdir: (path: string) => {
        const normalized = normalizePosixPath(path, cwd);
        const children = listChildren(Object.keys(filesState), normalized);
        return children.map((name) => ({ name, type: "file" as const }));
      },
      mkdir: (_path: string): void => {
        // Directories are inferred from file paths in this lightweight bridge.
      },
      rm: (path: string, options?: { recursive?: boolean }): void => {
        ensureMutableFilesState();
        const normalized = normalizePosixPath(path, cwd);
        if (options?.recursive) {
          for (const filePath of Object.keys(filesState)) {
            if (filePath === normalized || filePath.startsWith(`${normalized}/`)) {
              delete filesState[filePath];
            }
          }
          return;
        }
        delete filesState[normalized];
      },
      cp: (src: string, dst: string): void => {
        ensureMutableFilesState();
        const srcPath = normalizePosixPath(src, cwd);
        const dstPath = normalizePosixPath(dst, cwd);
        if (!Object.prototype.hasOwnProperty.call(filesState, srcPath)) {
          throw new Error(`No such file: ${srcPath}`);
        }
        filesState[dstPath] = filesState[srcPath];
      },
      mv: (src: string, dst: string): void => {
        ensureMutableFilesState();
        const srcPath = normalizePosixPath(src, cwd);
        const dstPath = normalizePosixPath(dst, cwd);
        if (!Object.prototype.hasOwnProperty.call(filesState, srcPath)) {
          throw new Error(`No such file: ${srcPath}`);
        }
        filesState[dstPath] = filesState[srcPath];
        delete filesState[srcPath];
      },
      chmod: (_path: string, _mode: number): void => {
        // No-op in lightweight custom bridge FS.
      },
    };

    const execFn = async (command: string, options: ExecOptions = {}): Promise<ExecResult> => {
      const subEnv = {
        ...envObject,
        ...options.env,
      };
      const subCwd = normalizePosixPath(options.cwd ?? cwd);
      let commandToRun = command;
      if (typeof options.stdin === "string" && options.stdin.length > 0) {
        subEnv.__MOON_BASH_STDIN =
          options.stdinKind === "bytes"
            ? options.stdin
            : latin1FromBytes(encodeUtf8ToBytes(options.stdin));
      }
      if (options.args && options.args.length > 0) {
        subEnv.__MOON_BASH_EXTRA_ARGS = JSON.stringify(options.args);
      }
      if (this.hasCustomCommands()) {
        commandToRun = this.buildCustomPrelude(commandToRun);
      }
      const subResult = JSON.parse(
        mbExecuteWithState(
          commandToRun,
          JSON.stringify(subEnv),
          JSON.stringify(filesState),
          "{}",
          "{}",
          "{}",
          subCwd,
          limitsJson,
          layoutMode,
        ),
      ) as StateExecResult;
      if (subResult.files && typeof subResult.files === "object") {
        filesState = subResult.files;
        filesMutable = false;
        filesDirty = true;
      }
      return {
        stdout: subResult.stdout ?? "",
        stderr: subResult.stderr ?? "",
        exitCode: Number.isFinite(subResult.exitCode) ? subResult.exitCode : 1,
      };
    };

    const context: CommandContext = {
      fs: fsApi,
      cwd,
      env: new Map(Object.entries(envObject)),
      stdin: unsafeBytesFromLatin1(request.stdin ?? ""),
      exec: execFn,
    };

    try {
      const maybeResult = customCommand.execute(
        Array.isArray(request.args) ? request.args : [],
        context,
      );
      const result = isPromiseLike<ExecResult>(maybeResult)
        ? await Promise.resolve(maybeResult)
        : maybeResult;
      return {
        handled: true,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: Number.isFinite(result.exitCode) ? Math.floor(result.exitCode) : 1,
        files: filesDirty ? filesState : undefined,
      };
    } catch (error) {
      return {
        handled: true,
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: toErrorMessage(error),
        files: filesDirty ? filesState : undefined,
      };
    }
  }

  private invokeDynamicImport(specifier: string): Promise<unknown> {
    return import(/* @vite-ignore */ specifier);
  }

  private isNodeRuntime(): boolean {
    const maybeProcess = globalThis as {
      process?: {
        versions?: {
          node?: string;
        };
      };
    };
    return typeof maybeProcess.process?.versions?.node === "string";
  }

  private async resolveNodeModulePath(specifier: string): Promise<string | undefined> {
    if (!this.isNodeRuntime()) {
      return undefined;
    }
    try {
      const nodeModule = (await this.invokeDynamicImport("node:module")) as {
        createRequire?: unknown;
        default?: {
          createRequire?: unknown;
        };
      };
      const createRequire = nodeModule.createRequire ?? nodeModule.default?.createRequire;
      if (typeof createRequire !== "function") {
        return undefined;
      }
      const requireFn = createRequire(import.meta.url) as {
        resolve?: (moduleName: string) => string;
      };
      if (typeof requireFn.resolve !== "function") {
        return undefined;
      }
      return requireFn.resolve(specifier);
    } catch {
      return undefined;
    }
  }

  private async resolveNodeDirname(pathValue: string): Promise<string | undefined> {
    if (!this.isNodeRuntime()) {
      return undefined;
    }
    try {
      const nodePath = (await this.invokeDynamicImport("node:path")) as {
        dirname?: unknown;
        default?: {
          dirname?: unknown;
        };
      };
      const dirname = nodePath.dirname ?? nodePath.default?.dirname;
      if (typeof dirname !== "function") {
        return undefined;
      }
      return dirname(pathValue);
    } catch {
      return undefined;
    }
  }

  private ensureTrailingSlash(pathValue: string): string {
    if (pathValue.endsWith("/") || pathValue.endsWith("\\")) {
      return pathValue;
    }
    return `${pathValue}/`;
  }

  private shouldEnablePythonWasm(): boolean {
    return this.options.python === true || this.options.vm?.wasm?.python?.enabled === true;
  }

  private shouldEnableSqliteWasm(): boolean {
    return this.options.sqlite === true || this.options.vm?.wasm?.sqlite?.enabled === true;
  }

  private normalizeVmPath(inputPath: string): string {
    if (!inputPath || inputPath.length === 0) {
      return "/";
    }
    const normalizedSlashes = inputPath.replace(/\\/g, "/");
    const absolute = normalizedSlashes.startsWith("/")
      ? normalizedSlashes
      : `/${normalizedSlashes}`;
    const out: string[] = [];
    for (const part of absolute.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        if (out.length > 0) {
          out.pop();
        }
        continue;
      }
      out.push(part);
    }
    if (out.length === 0) {
      return "/";
    }
    return `/${out.join("/")}`;
  }

  private normalizeVmCwd(cwd?: string): string {
    if (!cwd || cwd.length === 0) {
      return "/";
    }
    return this.normalizeVmPath(cwd);
  }

  private normalizeVmFiles(files?: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    if (!files || typeof files !== "object") {
      return normalized;
    }
    for (const [rawPath, rawContent] of Object.entries(files)) {
      const path = this.normalizeVmPath(rawPath);
      if (path === "/") {
        continue;
      }
      normalized[path] = rawContent ?? "";
    }
    return normalized;
  }

  private getVmTopRoot(path: string): string {
    const normalized = this.normalizeVmPath(path);
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 0) {
      return "/";
    }
    return `/${parts[0]}`;
  }

  private ensurePyodideDir(runtime: PyodideRuntimeLike, dirPath: string): void {
    const normalized = this.normalizeVmPath(dirPath);
    if (normalized === "/") {
      return;
    }
    const parts = normalized.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      try {
        if (!runtime.FS.analyzePath(current).exists) {
          runtime.FS.mkdir(current);
        }
      } catch {
        // Ignore race/invalid path errors; write step will surface real failure.
      }
    }
  }

  private writePyodideFile(runtime: PyodideRuntimeLike, path: string, content: string): void {
    const normalized = this.normalizeVmPath(path);
    if (normalized === "/") {
      return;
    }
    const slash = normalized.lastIndexOf("/");
    const parentDir = slash <= 0 ? "/" : normalized.slice(0, slash);
    this.ensurePyodideDir(runtime, parentDir);
    runtime.FS.writeFile(normalized, content ?? "");
  }

  private deletePyodideFile(runtime: PyodideRuntimeLike, path: string): void {
    const normalized = this.normalizeVmPath(path);
    if (normalized === "/") {
      return;
    }
    try {
      if (runtime.FS.analyzePath(normalized).exists) {
        runtime.FS.unlink(normalized);
      }
    } catch {
      // Ignore missing/unlink failures for non-tracked files.
    }
  }

  private readPyodideFile(runtime: PyodideRuntimeLike, path: string): string | undefined {
    const normalized = this.normalizeVmPath(path);
    if (normalized === "/") {
      return undefined;
    }
    try {
      if (!runtime.FS.analyzePath(normalized).exists) {
        return undefined;
      }
      return runtime.FS.readFile(normalized, { encoding: "utf8" });
    } catch {
      return undefined;
    }
  }

  private syncPyodideFiles(runtime: PyodideRuntimeLike, files: Record<string, string>): void {
    const nextPaths = new Set(Object.keys(files).map((path) => this.normalizeVmPath(path)));
    for (const trackedPath of this.pyodideTrackedFiles) {
      if (!nextPaths.has(trackedPath)) {
        this.deletePyodideFile(runtime, trackedPath);
      }
    }
    for (const [path, content] of Object.entries(files)) {
      this.writePyodideFile(runtime, path, content);
    }
    this.pyodideTrackedFiles = nextPaths;
  }

  private collectPyodideFilesFromRoots(
    runtime: PyodideRuntimeLike,
    roots: Set<string>,
    outFiles: Record<string, string>,
  ): void {
    const visitedDirs = new Set<string>();
    const maxDepth = 24;
    const maxFiles = 20000;
    let fileCount = 0;

    const walk = (dir: string, depth: number): void => {
      if (depth > maxDepth || fileCount >= maxFiles) {
        return;
      }
      const normalizedDir = this.normalizeVmPath(dir);
      if (visitedDirs.has(normalizedDir)) {
        return;
      }
      visitedDirs.add(normalizedDir);

      let entries: string[];
      try {
        entries = runtime.FS.readdir(normalizedDir);
      } catch {
        return;
      }

      for (const name of entries) {
        if (name === "." || name === "..") {
          continue;
        }
        const child = normalizedDir === "/" ? `/${name}` : `${normalizedDir}/${name}`;
        let stat: { mode: number };
        try {
          stat = runtime.FS.stat(child);
        } catch {
          continue;
        }

        if (runtime.FS.isDir(stat.mode)) {
          walk(child, depth + 1);
          continue;
        }

        const content = this.readPyodideFile(runtime, child);
        if (content !== undefined) {
          outFiles[this.normalizeVmPath(child)] = content;
        }
        fileCount += 1;
        if (fileCount >= maxFiles) {
          return;
        }
      }
    };

    for (const root of roots) {
      walk(root, 0);
    }
  }

  private resolvePyodideFilesSnapshot(
    runtime: PyodideRuntimeLike,
    request: MoonBashVmRequest,
    baseFiles: Record<string, string>,
  ): Record<string, string> {
    const snapshot: Record<string, string> = {};
    for (const path of this.pyodideTrackedFiles) {
      const content = this.readPyodideFile(runtime, path);
      if (content !== undefined) {
        snapshot[path] = content;
      }
    }

    const roots = new Set<string>();
    for (const path of Object.keys(baseFiles)) {
      const root = this.getVmTopRoot(path);
      if (root !== "/") {
        roots.add(root);
      }
    }

    if (request.cwd && request.cwd.startsWith("/")) {
      const cwdRoot = this.getVmTopRoot(request.cwd);
      if (cwdRoot !== "/") {
        roots.add(cwdRoot);
      }
    }

    if (Array.isArray(request.args) && request.args.length > 0) {
      const scriptPath = request.args[0];
      if (typeof scriptPath === "string" && scriptPath.startsWith("/")) {
        const scriptRoot = this.getVmTopRoot(scriptPath);
        if (scriptRoot !== "/") {
          roots.add(scriptRoot);
        }
      }
    }

    if (roots.size > 0) {
      this.collectPyodideFilesFromRoots(runtime, roots, snapshot);
    }

    this.pyodideTrackedFiles = new Set(Object.keys(snapshot));
    return snapshot;
  }

  private async loadDefaultPyodideRuntime(): Promise<PyodideRuntimeLike> {
    const pythonOptions = this.options.vm?.wasm?.python;
    let loadPyodideFn: ((options?: { indexURL?: string }) => Promise<unknown>) | null = null;
    const globalLoader = (globalThis as { loadPyodide?: unknown }).loadPyodide;
    if (typeof globalLoader === "function") {
      loadPyodideFn = globalLoader as (options?: { indexURL?: string }) => Promise<unknown>;
    }

    if (!loadPyodideFn) {
      let mod: unknown;
      try {
        mod = await this.invokeDynamicImport("pyodide");
      } catch (error) {
        throw new Error(
          `moon_bash: python3 wasm runtime requires Pyodide (module "pyodide"). ${toErrorMessage(error)}`,
        );
      }
      const maybeModule = mod as {
        loadPyodide?: unknown;
        default?: unknown;
      };
      const maybeFn =
        maybeModule.loadPyodide ??
        (
          maybeModule.default as
            | {
                loadPyodide?: unknown;
              }
            | undefined
        )?.loadPyodide ??
        maybeModule.default;
      if (typeof maybeFn !== "function") {
        throw new Error('moon_bash: unable to locate loadPyodide() in module "pyodide"');
      }
      loadPyodideFn = maybeFn as (options?: { indexURL?: string }) => Promise<unknown>;
    }

    let indexURL = pythonOptions?.indexURL;
    if (!indexURL) {
      const pyodideAsmPath = await this.resolveNodeModulePath("pyodide/pyodide.asm.js");
      if (pyodideAsmPath) {
        const pyodideDir = await this.resolveNodeDirname(pyodideAsmPath);
        if (pyodideDir) {
          indexURL = this.ensureTrailingSlash(pyodideDir);
        }
      }
    }

    const runtime = await loadPyodideFn(indexURL ? { indexURL } : undefined);
    if (!runtime || typeof runtime !== "object") {
      throw new Error("moon_bash: invalid Pyodide runtime object");
    }
    const candidate = runtime as {
      FS?: unknown;
      globals?: unknown;
      runPython?: unknown;
    };
    if (!candidate.FS || !candidate.globals || typeof candidate.runPython !== "function") {
      throw new Error("moon_bash: Pyodide runtime is missing required APIs");
    }
    return runtime as PyodideRuntimeLike;
  }

  private getPyodideRuntime(): Promise<PyodideRuntimeLike> {
    if (this.pyodideRuntime) {
      return Promise.resolve(this.pyodideRuntime);
    }
    if (this.pyodideRuntimePromise) {
      return this.pyodideRuntimePromise;
    }
    const customLoader = this.options.vm?.wasm?.python?.loadRuntime;
    this.pyodideRuntimePromise = (async () => {
      let runtime: PyodideRuntimeLike;
      if (customLoader) {
        const loaded = await Promise.resolve(customLoader());
        if (!loaded || typeof loaded !== "object") {
          throw new Error("moon_bash: vm.wasm.python.loadRuntime() returned invalid runtime");
        }
        const candidate = loaded as {
          FS?: unknown;
          globals?: unknown;
          runPython?: unknown;
        };
        if (!candidate.FS || !candidate.globals || typeof candidate.runPython !== "function") {
          throw new Error("moon_bash: custom python runtime is missing required APIs");
        }
        runtime = loaded as PyodideRuntimeLike;
      } else {
        runtime = await this.loadDefaultPyodideRuntime();
      }
      this.pyodideRuntime = runtime;
      return runtime;
    })();
    return this.pyodideRuntimePromise;
  }

  private parsePyodideExecResult(raw: unknown): MoonBashVmResponse {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      parsed = JSON.parse(raw);
    } else if (raw && typeof raw === "object" && "toString" in raw) {
      const maybeToString = (raw as { toString?: unknown }).toString;
      const asString = typeof maybeToString === "function" ? maybeToString.call(raw) : null;
      if (typeof asString === "string" && asString.startsWith("{") && asString.endsWith("}")) {
        parsed = JSON.parse(asString);
      }
    }
    if (!parsed || typeof parsed !== "object") {
      throw new Error("moon_bash: python3 runtime returned invalid payload");
    }
    const obj = parsed as {
      stdout?: unknown;
      stderr?: unknown;
      exitCode?: unknown;
      error?: unknown;
    };
    return {
      stdout: typeof obj.stdout === "string" ? obj.stdout : "",
      stderr: typeof obj.stderr === "string" ? obj.stderr : "",
      exitCode:
        typeof obj.exitCode === "number" && Number.isFinite(obj.exitCode)
          ? Math.floor(obj.exitCode)
          : 1,
      error: typeof obj.error === "string" ? obj.error : undefined,
    };
  }

  private runPythonWithPyodide(request: MoonBashVmRequest): MoonBashVmResponse {
    if (!this.pyodideRuntime) {
      throw new Error("moon_bash: python3 runtime is not initialized");
    }
    const runtime = this.pyodideRuntime;
    const vmFiles = this.normalizeVmFiles(request.files);
    this.syncPyodideFiles(runtime, vmFiles);
    const payload = {
      args: Array.isArray(request.args) ? request.args : [],
      stdin: request.stdin ?? "",
      cwd: this.normalizeVmCwd(request.cwd),
      env: request.env ?? {},
    };
    runtime.globals.set("__moon_bash_request_json", JSON.stringify(payload));
    const rawResult = runtime.runPython(PYODIDE_EXEC_SNIPPET);
    const response = this.parsePyodideExecResult(rawResult);
    response.files = this.resolvePyodideFilesSnapshot(
      runtime,
      { ...request, cwd: payload.cwd, files: vmFiles },
      vmFiles,
    );
    return response;
  }

  private bytesToBinaryString(bytes: Uint8Array): string {
    let out = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      const part = bytes.subarray(offset, Math.min(offset + chunk, bytes.length));
      out += String.fromCharCode(...part);
    }
    return out;
  }

  private binaryStringToBytes(content: string): Uint8Array {
    const bytes = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i += 1) {
      bytes[i] = content.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  private async loadDefaultSqlJsRuntime(): Promise<SqlJsRuntimeLike> {
    const sqliteOptions = this.options.vm?.wasm?.sqlite;
    let initSqlJs: SqlJsInitLike | null = null;
    const globalInit = (globalThis as { initSqlJs?: unknown }).initSqlJs;
    if (typeof globalInit === "function") {
      initSqlJs = globalInit as SqlJsInitLike;
    }

    if (!initSqlJs) {
      let mod: unknown;
      try {
        mod = await this.invokeDynamicImport("sql.js");
      } catch (error) {
        throw new Error(
          `moon_bash: sqlite3 wasm runtime requires sql.js (module "sql.js"). ${toErrorMessage(error)}`,
        );
      }
      const maybeModule = mod as {
        default?: unknown;
        initSqlJs?: unknown;
      };
      const maybeFn = maybeModule.default ?? maybeModule.initSqlJs;
      if (typeof maybeFn !== "function") {
        throw new Error("moon_bash: unable to locate sql.js initializer");
      }
      initSqlJs = maybeFn as SqlJsInitLike;
    }

    let resolvedWasmUrl = sqliteOptions?.wasmUrl;
    if (!resolvedWasmUrl) {
      resolvedWasmUrl = await this.resolveNodeModulePath("sql.js/dist/sql-wasm.wasm");
    }
    const locateFile = resolvedWasmUrl ? (_file: string) => resolvedWasmUrl as string : undefined;
    const runtime = await initSqlJs(locateFile ? { locateFile } : undefined);
    if (!runtime || typeof runtime !== "object" || typeof runtime.Database !== "function") {
      throw new Error("moon_bash: invalid sql.js runtime object");
    }
    return runtime as SqlJsRuntimeLike;
  }

  private getSqlJsRuntime(): Promise<SqlJsRuntimeLike> {
    if (this.sqlJsRuntime) {
      return Promise.resolve(this.sqlJsRuntime);
    }
    if (this.sqlJsRuntimePromise) {
      return this.sqlJsRuntimePromise;
    }
    const customLoader = this.options.vm?.wasm?.sqlite?.loadRuntime;
    this.sqlJsRuntimePromise = (async () => {
      let runtime: SqlJsRuntimeLike;
      if (!customLoader) {
        runtime = await this.loadDefaultSqlJsRuntime();
      } else {
        const loaded = await Promise.resolve(customLoader());
        if (!loaded) {
          throw new Error("moon_bash: vm.wasm.sqlite.loadRuntime() returned empty value");
        }
        if (typeof loaded === "function") {
          const initSqlJs = loaded as SqlJsInitLike;
          const sqliteOptions = this.options.vm?.wasm?.sqlite;
          const locateFile = sqliteOptions?.wasmUrl
            ? (_file: string) => sqliteOptions.wasmUrl as string
            : undefined;
          const initialized = await initSqlJs(locateFile ? { locateFile } : undefined);
          if (!initialized || typeof initialized.Database !== "function") {
            throw new Error("moon_bash: custom sqlite init function returned invalid runtime");
          }
          runtime = initialized;
        } else {
          if (
            typeof loaded !== "object" ||
            typeof (loaded as { Database?: unknown }).Database !== "function"
          ) {
            throw new Error("moon_bash: custom sqlite runtime is missing Database constructor");
          }
          runtime = loaded as SqlJsRuntimeLike;
        }
      }
      this.sqlJsRuntime = runtime;
      return runtime;
    })();
    return this.sqlJsRuntimePromise;
  }

  private parseSqliteArgs(args: string[]): {
    databasePath: string | null;
    sqlFromArgs: string;
  } {
    let databasePath: string | null = null;
    const sqlParts: string[] = [];
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === "-cmd" && i + 1 < args.length) {
        sqlParts.push(args[i + 1]);
        i += 1;
        continue;
      }
      if (arg.startsWith("-")) {
        continue;
      }
      if (databasePath === null) {
        databasePath = arg === ":memory:" ? ":memory:" : this.normalizeVmPath(arg);
        continue;
      }
      sqlParts.push(arg);
    }
    return {
      databasePath,
      sqlFromArgs: sqlParts.join("\n"),
    };
  }

  private formatSqliteCell(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (value instanceof Uint8Array) {
      return this.bytesToBinaryString(value);
    }
    if (
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "bigint" ||
      typeof value === "symbol"
    ) {
      return stringifyPrimitive(value);
    }
    return JSON.stringify(value);
  }

  private runSqliteWithSqlJs(request: MoonBashVmRequest): MoonBashVmResponse {
    if (!this.sqlJsRuntime) {
      throw new Error("moon_bash: sqlite3 runtime is not initialized");
    }
    const runtime = this.sqlJsRuntime;
    const files = this.normalizeVmFiles(request.files);
    const args = Array.isArray(request.args) ? request.args : [];
    const parsedArgs = this.parseSqliteArgs(args);
    const dbPath =
      parsedArgs.databasePath && parsedArgs.databasePath !== ":memory:"
        ? parsedArgs.databasePath
        : null;

    let db: SqlJsDatabaseLike;
    if (dbPath && Object.prototype.hasOwnProperty.call(files, dbPath)) {
      const fileContent = files[dbPath];
      try {
        db = new runtime.Database(this.binaryStringToBytes(fileContent));
      } catch {
        db = new runtime.Database();
        if (fileContent.trim().length > 0) {
          try {
            db.run(fileContent);
          } catch {
            // Ignore bootstrap SQL parsing errors; runtime SQL execution still returns an error.
          }
        }
      }
    } else {
      db = new runtime.Database();
    }

    const sqlText = [parsedArgs.sqlFromArgs, request.stdin ?? ""]
      .filter((part) => part.trim().length > 0)
      .join("\n");

    try {
      const lines: string[] = [];
      if (sqlText.trim().length > 0) {
        const resultSets = db.exec(sqlText);
        for (const resultSet of resultSets) {
          for (const row of resultSet.values) {
            lines.push(row.map((value) => this.formatSqliteCell(value)).join("|"));
          }
        }
      }

      const nextFiles: Record<string, string> = { ...files };
      if (dbPath) {
        nextFiles[dbPath] = this.bytesToBinaryString(db.export());
      }
      db.close();
      return {
        stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
        stderr: "",
        exitCode: 0,
        files: nextFiles,
      };
    } catch (error) {
      try {
        db.close();
      } catch {
        // Ignore close failure after runtime error.
      }
      return {
        stdout: "",
        stderr: `${toErrorMessage(error)}\n`,
        exitCode: 1,
        files,
      };
    }
  }

  private createDefaultWasmVmImpl(): VmBridgeImpl | undefined {
    const enablePython = this.shouldEnablePythonWasm();
    const enableSqlite = this.shouldEnableSqliteWasm();
    if (!enablePython && !enableSqlite) {
      return undefined;
    }

    return (request: MoonBashVmRequest): MoonBashVmResponse => {
      if (request.runtime === "python3") {
        if (!enablePython) {
          return {
            stdout: "",
            stderr: "",
            exitCode: 1,
            error: "python3 runtime is disabled",
            files: this.normalizeVmFiles(request.files),
          };
        }
        return this.runPythonWithPyodide(request);
      }
      if (request.runtime === "sqlite3") {
        if (!enableSqlite) {
          return {
            stdout: "",
            stderr: "",
            exitCode: 1,
            error: "sqlite3 runtime is disabled",
            files: this.normalizeVmFiles(request.files),
          };
        }
        return this.runSqliteWithSqlJs(request);
      }
      return {
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: `unsupported vm runtime: ${String(request.runtime)}`,
        files: this.normalizeVmFiles(request.files),
      };
    };
  }

  private async ensureDefaultVmRuntimesReady(): Promise<void> {
    if (this.options.vm?.run) {
      return;
    }
    if (this.shouldEnablePythonWasm()) {
      await this.getPyodideRuntime();
    }
    if (this.shouldEnableSqliteWasm()) {
      await this.getSqlJsRuntime();
    }
  }

  private createVmBridge(): MoonBashVmBridge | undefined {
    const vmImpl = this.options.vm?.run ?? this.createDefaultWasmVmImpl();
    if (!vmImpl) {
      return undefined;
    }

    return (requestJson: string): string => {
      try {
        const request = JSON.parse(requestJson) as MoonBashVmRequest;
        const maybeResponse = vmImpl(request);
        if (isPromiseLike<MoonBashVmResponse>(maybeResponse)) {
          return JSON.stringify({
            stdout: "",
            stderr: "",
            exitCode: 1,
            error: "async vm bridge is not supported by sync runtime",
          } satisfies MoonBashVmResponse);
        }
        const response = maybeResponse;
        return JSON.stringify(this.normalizeVmResponse(response));
      } catch (error) {
        return JSON.stringify({
          stdout: "",
          stderr: "",
          exitCode: 1,
          error: toErrorMessage(error),
        } satisfies MoonBashVmResponse);
      }
    };
  }

  private async handleCustomWorkerRequest(
    requestJson: string,
    limitsJson: string,
    layoutMode: "default" | "minimal",
  ): Promise<string> {
    try {
      const request = JSON.parse(requestJson) as MoonBashCustomRequest;
      const response = await this.runCustomCommandBridge(request, limitsJson, layoutMode);
      return JSON.stringify(this.normalizeCustomResponse(response));
    } catch (error) {
      return JSON.stringify({
        handled: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: toErrorMessage(error),
      } satisfies MoonBashCustomResponse);
    }
  }

  private enqueueNodeWorkerExec<T>(task: () => Promise<T>): Promise<T> {
    const run = this.nodeExecWorkerQueue.then(task);
    this.nodeExecWorkerQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async resolveNodeEntryModuleUrl(): Promise<string> {
    if (this.nodeEntryModuleUrlPromise) {
      return this.nodeEntryModuleUrlPromise;
    }
    this.nodeEntryModuleUrlPromise = (async () => {
      const candidates = [
        new URL("../_build/js/release/build/lib/entry/entry.js", import.meta.url),
        new URL("../_build/js/debug/build/lib/entry/entry.js", import.meta.url),
      ];

      try {
        const fsModule = (await this.invokeDynamicImport("node:fs")) as {
          existsSync?: (path: string | URL) => boolean;
          default?: {
            existsSync?: (path: string | URL) => boolean;
          };
        };
        const existsSync = fsModule.existsSync ?? fsModule.default?.existsSync;
        if (typeof existsSync === "function") {
          for (const candidate of candidates) {
            if (existsSync(candidate)) {
              return candidate.href;
            }
          }
        }
      } catch {
        // Fall back to import probing below.
      }

      for (const candidate of candidates) {
        try {
          await this.invokeDynamicImport(candidate.href);
          return candidate.href;
        } catch {
          // Try next candidate.
        }
      }

      return candidates[0].href;
    })();
    return this.nodeEntryModuleUrlPromise;
  }

  private clearNodeExecWorkerIdleTimer(): void {
    if (!this.nodeExecWorkerIdleTimer) {
      return;
    }
    clearTimeout(this.nodeExecWorkerIdleTimer);
    this.nodeExecWorkerIdleTimer = null;
  }

  private scheduleNodeExecWorkerIdleTermination(): void {
    if (!this.nodeExecWorker) {
      return;
    }
    this.clearNodeExecWorkerIdleTimer();
    const idleTimeoutMs = 200;
    const timer = setTimeout(() => {
      this.nodeExecWorkerIdleTimer = null;
      if (this.nodeExecWorkerPendingExec.size > 0 || this.nodeExecWorkerBridgeContext) {
        this.scheduleNodeExecWorkerIdleTermination();
        return;
      }
      void this.terminateNodeExecWorker();
    }, idleTimeoutMs);
    const maybeUnref = timer as unknown as { unref?: () => void };
    if (typeof maybeUnref.unref === "function") {
      maybeUnref.unref();
    }
    this.nodeExecWorkerIdleTimer = timer;
  }

  private async terminateNodeExecWorker(): Promise<void> {
    this.clearNodeExecWorkerIdleTimer();
    const worker = this.nodeExecWorker;
    if (!worker) {
      return;
    }
    if (this.nodeExecWorkerPendingExec.size > 0 || this.nodeExecWorkerBridgeContext) {
      return;
    }
    this.nodeExecWorker = null;
    this.nodeExecWorkerBridgeContext = null;
    this.nodeExecWorkerInitPromise = null;
    try {
      worker.postMessage({ type: "shutdown" });
    } catch {
      // Ignore shutdown post failures; terminate() below is authoritative.
    }
    try {
      const terminated = worker.terminate();
      if (isPromiseLike<number>(terminated)) {
        await terminated.catch(() => undefined);
      }
    } catch {
      // Ignore termination failures during idle cleanup.
    }
  }

  private resetNodeExecWorker(error: Error): void {
    this.clearNodeExecWorkerIdleTimer();
    const worker = this.nodeExecWorker;
    this.nodeExecWorker = null;
    this.nodeExecWorkerBridgeContext = null;
    this.nodeExecWorkerInitPromise = null;
    if (worker) {
      try {
        const terminated = worker.terminate();
        if (isPromiseLike<number>(terminated)) {
          void terminated.catch(() => undefined);
        }
      } catch {
        // Ignore termination failures during reset.
      }
    }
    for (const pending of this.nodeExecWorkerPendingExec.values()) {
      pending.reject(error);
    }
    this.nodeExecWorkerPendingExec.clear();
  }

  private createNodeExecWorkerSource(entryModuleUrl: string): string {
    return `
import { parentPort, receiveMessageOnPort } from "node:worker_threads";
import { execute_with_state as mbExecuteWithState } from ${JSON.stringify(entryModuleUrl)};

if (!parentPort) {
  throw new Error("moon_bash: worker parent port is unavailable");
}

const idle = new Int32Array(new SharedArrayBuffer(4));
let bridgeSeq = 0;
const mailbox = [];

function receiveMatching(match) {
  // receiveMessageOnPort is consumptive; keep unmatched messages in mailbox.
  for (let i = 0; i < mailbox.length; i += 1) {
    const candidate = mailbox[i];
    if (match(candidate)) {
      mailbox.splice(i, 1);
      return candidate;
    }
  }
  while (true) {
    const packet = receiveMessageOnPort(parentPort);
    if (packet) {
      const message = packet.message;
      if (match(message)) {
        return message;
      }
      mailbox.push(message);
      continue;
    }
    Atomics.wait(idle, 0, 0, 10);
  }
}

function callBridge(bridge, payload) {
  const id = ++bridgeSeq;
  parentPort.postMessage({ type: "bridge-request", id, bridge, payload });
  const message = receiveMatching((candidate) =>
    candidate && candidate.type === "bridge-response" && candidate.id === id
  );
  return typeof message.payload === "string" ? message.payload : "";
}

globalThis.__moon_bash_fetch = (requestJson) => callBridge("fetch", requestJson);
globalThis.__moon_bash_sleep = (durationMs) => callBridge("sleep", String(durationMs));
globalThis.__moon_bash_now = () => {
  const value = Number(callBridge("now", ""));
  return Number.isFinite(value) ? value : 0;
};
globalThis.__moon_bash_wall_now = () => {
  const value = Number(callBridge("wall-now", ""));
  return Number.isFinite(value) ? value : 0;
};
globalThis.__moon_bash_vm = (requestJson) => callBridge("vm", requestJson);
globalThis.__moon_bash_custom = (requestJson) => callBridge("custom", requestJson);

while (true) {
  const message = receiveMatching((candidate) =>
    candidate && (candidate.type === "exec" || candidate.type === "shutdown")
  );
  if (message.type === "shutdown") {
    break;
  }
  try {
    const jsonResult = mbExecuteWithState(
      message.script,
      message.envJson,
      message.filesJson,
      message.dirsJson,
      message.linksJson,
      message.modesJson,
      message.cwd,
      message.limitsJson,
      message.layoutMode,
    );
    parentPort.postMessage({ type: "exec-result", id: message.id, jsonResult });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    parentPort.postMessage({ type: "exec-error", id: message.id, error: details });
  }
}
`;
  }

  private async ensureNodeExecWorker(): Promise<NodeWorkerLike> {
    if (this.nodeExecWorker) {
      return this.nodeExecWorker;
    }
    if (this.nodeExecWorkerInitPromise) {
      return this.nodeExecWorkerInitPromise;
    }

    this.nodeExecWorkerInitPromise = (async () => {
      const workerThreads = (await this.invokeDynamicImport("node:worker_threads")) as {
        Worker?: new (specifier: string, options?: Record<string, unknown>) => NodeWorkerLike;
      };
      const WorkerCtor = workerThreads.Worker;
      if (typeof WorkerCtor !== "function") {
        throw new Error("moon_bash: node worker runtime is unavailable");
      }

      const entryModuleUrl = await this.resolveNodeEntryModuleUrl();
      const worker = new WorkerCtor(this.createNodeExecWorkerSource(entryModuleUrl), {
        eval: true,
        type: "module",
      });
      if (typeof worker.unref === "function") {
        worker.unref();
      }

      worker.on("message", (rawMessage: unknown) => {
        if (!rawMessage || typeof rawMessage !== "object") {
          return;
        }
        const message = rawMessage as Record<string, unknown>;
        const type = typeof message.type === "string" ? message.type : "";

        if (type === "bridge-request") {
          const requestId = message.id;
          const bridge = typeof message.bridge === "string" ? message.bridge : "";
          const payload = typeof message.payload === "string" ? message.payload : "";
          const context = this.nodeExecWorkerBridgeContext;
          void Promise.resolve()
            .then(async () => {
              if (!context) {
                return "";
              }
              if (bridge === "custom") {
                return await this.handleCustomWorkerRequest(
                  payload,
                  context.limitsJson,
                  context.layoutMode,
                );
              }
              if (bridge === "fetch") {
                return context.fetchBridge ? context.fetchBridge(payload) : "";
              }
              if (bridge === "sleep") {
                const durationMs = Number.parseInt(payload, 10);
                return context.sleepBridge
                  ? context.sleepBridge(Number.isFinite(durationMs) ? durationMs : 0)
                  : "";
              }
              if (bridge === "now") {
                return context.nowBridge ? context.nowBridge().toString() : "0";
              }
              if (bridge === "wall-now") {
                return context.wallNowBridge ? context.wallNowBridge().toString() : "0";
              }
              if (bridge === "vm") {
                return context.vmBridge ? context.vmBridge(payload) : "";
              }
              return "";
            })
            .then((responsePayload) => {
              worker.postMessage({
                type: "bridge-response",
                id: requestId,
                payload: responsePayload,
              });
            })
            .catch((error) => {
              const fallback =
                bridge === "custom"
                  ? JSON.stringify({
                      handled: false,
                      stdout: "",
                      stderr: "",
                      exitCode: 1,
                      error: toErrorMessage(error),
                    } satisfies MoonBashCustomResponse)
                  : "";
              worker.postMessage({ type: "bridge-response", id: requestId, payload: fallback });
            });
          return;
        }

        if (type === "exec-result" || type === "exec-error") {
          const id = typeof message.id === "number" ? message.id : Number.NaN;
          if (!Number.isFinite(id)) {
            return;
          }
          const pending = this.nodeExecWorkerPendingExec.get(id);
          if (!pending) {
            return;
          }
          this.nodeExecWorkerPendingExec.delete(id);
          if (type === "exec-error") {
            pending.reject(
              new Error(toErrorMessage(message.error ?? "moon_bash: worker execution failed")),
            );
            return;
          }
          try {
            const jsonResult = typeof message.jsonResult === "string" ? message.jsonResult : "{}";
            const parsed = JSON.parse(jsonResult) as StateExecResult;
            pending.resolve(parsed);
          } catch (error) {
            pending.reject(error instanceof Error ? error : new Error(String(error)));
          }
        }
      });

      worker.on("error", (error: unknown) => {
        const normalized = error instanceof Error ? error : new Error(String(error));
        this.resetNodeExecWorker(normalized);
      });

      this.nodeExecWorker = worker;
      return worker;
    })();

    try {
      return await this.nodeExecWorkerInitPromise;
    } finally {
      this.nodeExecWorkerInitPromise = null;
    }
  }

  private async execWithNodeCustomWorker(
    scriptToRun: string,
    envJson: string,
    filesJson: string,
    dirsJson: string,
    linksJson: string,
    modesJson: string,
    cwd: string,
    limitsJson: string,
    layoutMode: "default" | "minimal",
  ): Promise<StateExecResult> {
    return this.enqueueNodeWorkerExec(async () => {
      try {
        this.clearNodeExecWorkerIdleTimer();
        const worker = await this.ensureNodeExecWorker();
        const execId = this.nodeExecWorkerExecSeq;
        this.nodeExecWorkerExecSeq += 1;
        this.nodeExecWorkerBridgeContext = {
          limitsJson,
          layoutMode,
          fetchBridge: this.createFetchBridge(),
          sleepBridge: this.createSleepBridge(),
          nowBridge: this.createNowBridge(),
          wallNowBridge: this.createWallNowBridge(),
          vmBridge: this.createVmBridge(),
        };

        try {
          return await new Promise<StateExecResult>((resolve, reject) => {
            this.nodeExecWorkerPendingExec.set(execId, { resolve, reject });
            try {
              worker.postMessage({
                type: "exec",
                id: execId,
                script: scriptToRun,
                envJson,
                filesJson,
                dirsJson,
                linksJson,
                modesJson,
                cwd,
                limitsJson,
                layoutMode,
              });
            } catch (error) {
              this.nodeExecWorkerPendingExec.delete(execId);
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        } finally {
          this.nodeExecWorkerBridgeContext = null;
        }
      } finally {
        this.scheduleNodeExecWorkerIdleTermination();
      }
    });
  }

  /**
   * Execute a bash script in the sandbox.
   * Returns stdout, stderr, and exit code.
   */
  async exec(script: string, execOptions: ExecOptions = {}): Promise<BashExecResult> {
    await this.ensureDefaultVmRuntimesReady();
    const logger = this.getLogger();
    const isEmptyScript = script.trim().length === 0;
    if (!isEmptyScript && logger) {
      logger.info("exec", { command: script });
    }

    const effectiveEnv: Record<string, string> = {
      ...(execOptions.replaceEnv ? {} : this.baseEnv),
      ...execOptions.env,
      ...this.createVirtualProcessEnv(this.options.processInfo),
    };
    if (execOptions.signal?.aborted) {
      return {
        stdout: "",
        stderr: "",
        exitCode: 124,
        env: { ...effectiveEnv },
      };
    }
    const allowed = Array.isArray(this.options.commands)
      ? [...this.options.commands]
      : this.getRegisteredCommandNamesForLayout();
    if (this.hasCustomCommands()) {
      allowed.push("__moon_bash_custom__");
    }
    effectiveEnv.__MOON_BASH_ALLOWED_COMMANDS = allowed.join(",");

    const cwd = normalizePosixPath(execOptions.cwd ?? this.baseCwd);
    const limitsJson = this.encodeLimitsJson();
    const layoutMode: "default" | "minimal" = this.useDefaultLayout ? "default" : "minimal";

    let scriptToRun = script;
    if (typeof execOptions.stdin === "string" && execOptions.stdin.length > 0) {
      effectiveEnv.__MOON_BASH_STDIN =
        execOptions.stdinKind === "bytes"
          ? execOptions.stdin
          : latin1FromBytes(encodeUtf8ToBytes(execOptions.stdin));
    }
    if (execOptions.args && execOptions.args.length > 0) {
      effectiveEnv.__MOON_BASH_EXTRA_ARGS = JSON.stringify(execOptions.args);
    }
    if (this.hasCustomCommands()) {
      scriptToRun = this.buildCustomPrelude(scriptToRun);
    }
    this.recordCoverage(scriptToRun);
    const envJson = JSON.stringify(effectiveEnv);
    const filesJson = JSON.stringify(this.files);
    const dirsJson = JSON.stringify(this.dirs);
    const linksJson = JSON.stringify(this.links);
    const modesJson = JSON.stringify(this.modes);

    if (this.hasCustomCommands() && this.isNodeRuntime()) {
      const parsed = await this.execWithNodeCustomWorker(
        scriptToRun,
        envJson,
        filesJson,
        dirsJson,
        linksJson,
        modesJson,
        cwd,
        limitsJson,
        layoutMode,
      );
      this.applyState(parsed);
      const result: BashExecResult = {
        stdout: parsed.stdout ?? "",
        stderr: parsed.stderr ?? "",
        exitCode: Number.isFinite(parsed.exitCode) ? parsed.exitCode : 1,
        env: this.stripInternalEnv(parsed.env && typeof parsed.env === "object" ? parsed.env : effectiveEnv),
      };
      const normalizedResult = this.normalizeExecResult(result);
      if (!isEmptyScript && logger) {
        if (normalizedResult.stdout.length > 0) {
          logger.debug("stdout", { output: normalizedResult.stdout });
        }
        if (normalizedResult.stderr.length > 0) {
          logger.info("stderr", { output: normalizedResult.stderr });
        }
        logger.info("exit", { exitCode: normalizedResult.exitCode });
      }
      return normalizedResult;
    }

    const fetchBridge = this.createFetchBridge();
    const sleepBridge = this.createSleepBridge();
    const nowBridge = this.createNowBridge();
    const wallNowBridge = this.createWallNowBridge();
    const vmBridge = this.createVmBridge();
    const customBridge = this.createCustomBridge(limitsJson, layoutMode);
    const previousFetchBridge = globalThis.__moon_bash_fetch;
    const previousSleepBridge = globalThis.__moon_bash_sleep;
    const previousNowBridge = globalThis.__moon_bash_now;
    const previousWallNowBridge = globalThis.__moon_bash_wall_now;
    const previousVmBridge = globalThis.__moon_bash_vm;
    const previousCustomBridge = globalThis.__moon_bash_custom;
    globalThis.__moon_bash_fetch = fetchBridge;
    globalThis.__moon_bash_sleep = sleepBridge;
    globalThis.__moon_bash_now = nowBridge;
    globalThis.__moon_bash_wall_now = wallNowBridge;
    globalThis.__moon_bash_vm = vmBridge;
    globalThis.__moon_bash_custom = customBridge;

    try {
      const jsonResult = mbExecuteWithState(
        scriptToRun,
        envJson,
        filesJson,
        dirsJson,
        linksJson,
        modesJson,
        cwd,
        limitsJson,
        layoutMode,
      );
      const parsed = JSON.parse(jsonResult) as StateExecResult;
      this.applyState(parsed);
      const result: BashExecResult = {
        stdout: parsed.stdout ?? "",
        stderr: parsed.stderr ?? "",
        exitCode: Number.isFinite(parsed.exitCode) ? parsed.exitCode : 1,
        env: this.stripInternalEnv(parsed.env && typeof parsed.env === "object" ? parsed.env : effectiveEnv),
      };
      const normalizedResult = this.normalizeExecResult(result);
      if (!isEmptyScript && logger) {
        if (normalizedResult.stdout.length > 0) {
          logger.debug("stdout", { output: normalizedResult.stdout });
        }
        if (normalizedResult.stderr.length > 0) {
          logger.info("stderr", { output: normalizedResult.stderr });
        }
        logger.info("exit", { exitCode: normalizedResult.exitCode });
      }
      return normalizedResult;
    } finally {
      if (previousFetchBridge === undefined) {
        delete globalThis.__moon_bash_fetch;
      } else {
        globalThis.__moon_bash_fetch = previousFetchBridge;
      }
      if (previousSleepBridge === undefined) {
        delete globalThis.__moon_bash_sleep;
      } else {
        globalThis.__moon_bash_sleep = previousSleepBridge;
      }
      if (previousNowBridge === undefined) {
        delete globalThis.__moon_bash_now;
      } else {
        globalThis.__moon_bash_now = previousNowBridge;
      }
      if (previousWallNowBridge === undefined) {
        delete globalThis.__moon_bash_wall_now;
      } else {
        globalThis.__moon_bash_wall_now = previousWallNowBridge;
      }
      if (previousVmBridge === undefined) {
        delete globalThis.__moon_bash_vm;
      } else {
        globalThis.__moon_bash_vm = previousVmBridge;
      }
      if (previousCustomBridge === undefined) {
        delete globalThis.__moon_bash_custom;
      } else {
        globalThis.__moon_bash_custom = previousCustomBridge;
      }
    }
  }

  async readFile(path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
      return this.files[normalized];
    }
    throw new Error(`No such file: ${normalized}`);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalized = this.normalizePath(path);
    this.files[normalized] = content;
    this.modes[normalized] = (0o644).toString();
    this.addParentDirs(normalized);
  }

  getCwd(): string {
    return this.baseCwd;
  }

  getEnv(): Record<string, string> {
    return this.stripInternalEnv(this.baseEnv);
  }

  /**
   * Get the virtual filesystem interface.
   */
  getFs(): IFileSystem {
    return this.fs;
  }

  registerTransformPlugin(plugin: TransformPlugin<object>): void {
    this.transformPlugins.push(plugin);
  }

  transform(script: string): BashTransformResult {
    let ast = parse(script);
    let metadata: Record<string, unknown> = {};
    for (const plugin of this.transformPlugins) {
      const result = plugin.transform({ ast, metadata });
      ast = result.ast;
      metadata = { ...metadata, ...(result.metadata ?? {}) };
    }
    return {
      script: serialize(ast),
      ast,
      metadata,
    };
  }
}

/**
 * Convenience function to execute a bash command.
 * Creates a temporary Bash instance with the given options.
 *
 * @example
 * ```ts
 * const result = await exec('echo hello', { env: { USER: 'agent' } });
 * ```
 */
export async function exec(
  script: string,
  options: BashOptions = {},
  execOptions: ExecOptions = {},
): Promise<BashExecResult> {
  const bash = new Bash(options);
  return bash.exec(script, execOptions);
}
