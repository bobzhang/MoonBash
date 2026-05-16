import type { Writable } from "node:stream";
import { Bash } from "./core";
import { OverlayFs } from "./overlay-fs";
import type { IFileSystem } from "./fs";
import type { BashOptions, ExecOptions } from "./types";
import type { NetworkConfig } from "./network";
import type { DefenseInDepthConfig } from "./security";

export interface SandboxOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  fs?: IFileSystem;
  overlayRoot?: string;
  maxCallDepth?: number;
  maxCommandCount?: number;
  maxLoopIterations?: number;
  network?: NetworkConfig;
  defenseInDepth?: DefenseInDepthConfig | boolean;
}

export interface RunCommandParams {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  sudo?: boolean;
  detached?: boolean;
  stdout?: Writable;
  stderr?: Writable;
  signal?: AbortSignal;
}

export interface WriteFilesInput {
  [path: string]: string | {
    content: string;
    encoding?: "utf-8" | "base64";
  };
}

export interface OutputMessage {
  type: "stdout" | "stderr";
  data: string;
  timestamp: Date;
}

export interface CommandFinished extends SandboxCommand {
  exitCode: number;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function decodeBase64(content: string): string {
  const bufferCtor = (globalThis as { Buffer?: { from(data: string, encoding: "base64"): { toString(): string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(content, "base64").toString();
  }
  if (typeof atob === "function") {
    return atob(content);
  }
  throw new Error("base64 decoding is not available in this runtime");
}

function encodeBase64(content: string): string {
  const bufferCtor = (globalThis as { Buffer?: { from(data: string): { toString(encoding: "base64"): string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(content).toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(content);
  }
  throw new Error("base64 encoding is not available in this runtime");
}

export class SandboxCommand {
  readonly cmdId = randomId();
  readonly startedAt = new Date();
  exitCode: number | undefined;
  private resultPromise: Promise<CommandFinished>;
  private killed = false;
  private cachedStdout = "";
  private cachedStderr = "";

  constructor(
    private readonly bash: Bash,
    private readonly cmdLine: string,
    readonly cwd: string,
    private readonly env?: Record<string, string>,
    private readonly signal?: AbortSignal,
    private readonly timeoutMs?: number,
    private readonly stdoutStream?: Writable,
    private readonly stderrStream?: Writable,
  ) {
    this.resultPromise = this.execute();
  }

  private async execute(): Promise<CommandFinished> {
    if (this.signal?.aborted || this.killed) {
      this.exitCode = 124;
      return this as CommandFinished;
    }
    const execOptions: ExecOptions = {
      cwd: this.cwd,
      env: this.env,
      signal: this.signal,
    };
    const run = this.bash.exec(this.cmdLine, execOptions);
    let result = this.timeoutMs && this.timeoutMs > 0
      ? await Promise.race([
        run,
        new Promise<Awaited<typeof run>>((resolve) => {
          setTimeout(() => resolve({
            stdout: "",
            stderr: "",
            exitCode: 124,
            env: {},
          }), this.timeoutMs);
        }),
      ])
      : await run;
    if (this.killed) {
      result = { ...result, stdout: "", stderr: "", exitCode: 124 };
    }
    this.exitCode = result.exitCode;
    this.cachedStdout = result.stdout;
    this.cachedStderr = result.stderr;
    if (this.cachedStdout) {
      this.stdoutStream?.write(this.cachedStdout);
    }
    if (this.cachedStderr) {
      this.stderrStream?.write(this.cachedStderr);
    }
    return this as CommandFinished;
  }

  async *logs(): AsyncGenerator<OutputMessage, void, unknown> {
    await this.wait();
    const timestamp = new Date();
    if (this.cachedStdout) {
      yield { type: "stdout", data: this.cachedStdout, timestamp };
    }
    if (this.cachedStderr) {
      yield { type: "stderr", data: this.cachedStderr, timestamp };
    }
  }

  async wait(): Promise<CommandFinished> {
    return this.resultPromise;
  }

  async output(): Promise<string> {
    await this.wait();
    return `${this.cachedStdout}${this.cachedStderr}`;
  }

  async stdout(): Promise<string> {
    await this.wait();
    return this.cachedStdout;
  }

  async stderr(): Promise<string> {
    await this.wait();
    return this.cachedStderr;
  }

  async kill(): Promise<void> {
    this.killed = true;
  }
}

export class Sandbox {
  private constructor(
    private readonly bashEnv: Bash,
    private readonly fs: IFileSystem | undefined,
    private timeoutMs?: number,
  ) {}

  static async create(opts: SandboxOptions = {}): Promise<Sandbox> {
    if (opts.fs && opts.overlayRoot) {
      throw new Error("Cannot specify both 'fs' and 'overlayRoot' options");
    }
    const limits = {
      ...(opts.maxCallDepth !== undefined ? { maxCallDepth: opts.maxCallDepth } : {}),
      ...(opts.maxCommandCount !== undefined ? { maxCommandCount: opts.maxCommandCount } : {}),
      ...(opts.maxLoopIterations !== undefined ? { maxLoopIterations: opts.maxLoopIterations } : {}),
    };
    const fs = opts.fs ?? (opts.overlayRoot ? new OverlayFs({ root: opts.overlayRoot }) : undefined);
    const bashOptions: BashOptions = {
      cwd: opts.cwd,
      env: opts.env,
      fs,
      network: opts.network,
      defenseInDepth: opts.defenseInDepth,
      limits,
    };
    return new Sandbox(new Bash(bashOptions), fs, opts.timeoutMs);
  }

  runCommand(params: RunCommandParams & { detached: true }): Promise<SandboxCommand>;
  runCommand(params: RunCommandParams): Promise<CommandFinished>;
  runCommand(command: string, args: string[], opts?: { signal?: AbortSignal }): Promise<CommandFinished>;
  runCommand(command: string, opts?: { cwd?: string; env?: Record<string, string> }): Promise<CommandFinished>;
  async runCommand(
    commandOrParams: string | RunCommandParams,
    argsOrOpts?: string[] | { cwd?: string; env?: Record<string, string>; signal?: AbortSignal },
    opts?: { signal?: AbortSignal },
  ): Promise<SandboxCommand | CommandFinished> {
    const params = typeof commandOrParams === "string"
      ? {
        cmd: commandOrParams,
        args: Array.isArray(argsOrOpts) ? argsOrOpts : undefined,
        cwd: !Array.isArray(argsOrOpts) ? argsOrOpts?.cwd : undefined,
        env: !Array.isArray(argsOrOpts) ? argsOrOpts?.env : undefined,
        signal: Array.isArray(argsOrOpts) ? opts?.signal : argsOrOpts?.signal,
      }
      : commandOrParams;
    const cmdLine = params.args
      ? [params.cmd, ...params.args].map(shellQuote).join(" ")
      : params.cmd;
    const command = new SandboxCommand(
      this.bashEnv,
      cmdLine,
      params.cwd ?? this.bashEnv.getCwd(),
      params.env,
      params.signal,
      this.timeoutMs,
      params.stdout,
      params.stderr,
    );
    return params.detached ? command : command.wait();
  }

  async writeFiles(files: WriteFilesInput): Promise<void> {
    for (const [path, value] of Object.entries(files)) {
      const content = typeof value === "string"
        ? value
        : value.encoding === "base64"
          ? decodeBase64(value.content)
          : value.content;
      if (this.fs) {
        await this.fs.writeFile(path, content);
      }
      await this.bashEnv.writeFile(path, content);
    }
  }

  async readFile(path: string, encoding: "utf-8" | "base64" = "utf-8"): Promise<string> {
    const content = this.fs
      ? await this.fs.readFile(path)
      : await this.bashEnv.readFile(path);
    return encoding === "base64" ? encodeBase64(content) : content;
  }

  async mkDir(path: string, opts?: { recursive?: boolean }): Promise<void> {
    if (this.fs) {
      await this.fs.mkdir(path, opts);
    }
    this.bashEnv.getFs().mkdir(path, opts);
  }

  async stop(): Promise<void> {
    // No background process is retained by the in-process Bash runner.
  }

  async extendTimeout(ms: number): Promise<void> {
    this.timeoutMs = ms;
  }

  get domain(): string | undefined {
    return undefined;
  }

  get bashEnvInstance(): Bash {
    return this.bashEnv;
  }
}
