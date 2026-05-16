# just-bash 3 Surface Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first compatibility slice for `just-bash@3.0.1`: API matrix tests, public export/command-name parity, ByteString helpers, and low-risk `ExecOptions` behavior.

**Architecture:** Keep shell execution in the existing MoonBit kernel, but make the TypeScript wrapper expose the upstream-compatible public API surface. This plan intentionally avoids full FS, Sandbox, Transform, `js-exec`, and executor implementations; it creates the verified baseline those later plans depend on.

**Tech Stack:** MoonBit JS target, TypeScript wrapper, vite-plus/Vitest tests, generated MoonBit JS release build, upstream `just-bash@3.0.1` as the compatibility reference.

---

## File Structure

- Create `src/wrapper/commands/registry.ts`: public command-name type unions and helper arrays matching `just-bash@3.0.1` registration groups.
- Create `src/wrapper/encoding.ts`: ByteString and output-kind helper API compatible with upstream 3.0.
- Create `src/wrapper/compat/just-bash-3.ts`: reference constants for export keys and command groups used by tests. This file prevents tests from hard-coding scattered lists.
- Create `src/wrapper/network.ts`: upstream-compatible network types and conservative error classes used by `BashOptions.fetch`/`network`.
- Modify `src/wrapper/types.ts`: extend public type surface for `ExecOptions`, `BashOptions`, `CommandContext`, `ExecResult`, `JavaScriptConfig`, network hooks, and defense-in-depth hooks.
- Modify `src/wrapper/index.ts`: re-export new APIs, use command registry helpers, add `Sandbox.create`, expose JavaScript command registration semantics as stubs, and implement low-risk `ExecOptions` behavior.
- Modify `src/wrapper/browser.ts`: export the safe browser-compatible subset; full browser export-map parity is handled by the later packaging plan.
- Modify `src/lib/commands/registry.mbt`: add `python` alias and disabled VM bridge entries for `js-exec`/`node` until the runtime parity plan implements QuickJS.
- Modify `src/lib/interpreter/interpreter_execution_helpers.mbt`: keep shell builtins available while hiding optional command groups behind the wrapper allowlist.
- Modify `src/lib/interpreter/interpreter.mbt`: initialize stdin from a wrapper bridge env key and remove that bridge key before user code can inspect env.
- Modify `src/lib/interpreter/interpreter_execution.mbt`: append `ExecOptions.args` to the first simple command only.
- Create `src/lib/interpreter/json_bridge.mbt`: parse the JSON string-array bridge used for `ExecOptions.args`.
- Create `tests/unit/compat/just-bash-api-surface.test.ts`: runtime export and command helper parity tests.
- Create `tests/unit/encoding.test.ts`: ByteString helper and stdout kind tests.
- Create `tests/unit/Bash.exec-options-3.test.ts`: `replaceEnv`, `args`, `stdinKind`, and initial `signal` tests.
- Update `tests/unit/Bash.commands.test.ts`: align command helper expectations with upstream optional command groups.

## Authoritative Upstream Reference

Use this exact baseline unless `npm view just-bash version` changes before implementation starts:

```bash
npm view just-bash version
# Expected: 3.0.1
npm view @just-bash/executor version
# Expected: 1.0.2
```

The root export list to target in this plan is:

```ts
export const JUST_BASH_3_ROOT_EXPORTS = [
  "Bash",
  "BashTransformPipeline",
  "CommandCollectorPlugin",
  "DefenseInDepthBox",
  "InMemoryFs",
  "MountableFs",
  "NetworkAccessDeniedError",
  "OverlayFs",
  "ReadWriteFs",
  "RedirectNotAllowedError",
  "Sandbox",
  "SandboxCommand",
  "SecurityViolationError",
  "SecurityViolationLogger",
  "TeePlugin",
  "TooManyRedirectsError",
  "bytesOutput",
  "createConsoleViolationCallback",
  "decodeBytesToUtf8",
  "defineCommand",
  "encodeUtf8ToBytes",
  "getCommandNames",
  "getJavaScriptCommandNames",
  "getNetworkCommandNames",
  "getPythonCommandNames",
  "latin1FromBytes",
  "parse",
  "serialize",
  "stdoutAsBytes",
  "stdoutKind",
  "textOutput",
  "unsafeBytesFromLatin1",
] as const;
```

The command groups to target in this plan are:

```ts
export const JUST_BASH_3_COMMAND_NAMES = [
  "echo", "cat", "printf", "ls", "mkdir", "rmdir", "touch", "rm",
  "cp", "mv", "ln", "chmod", "pwd", "readlink", "head", "tail",
  "wc", "stat", "grep", "fgrep", "egrep", "rg", "sed", "awk",
  "sort", "uniq", "comm", "cut", "paste", "tr", "rev", "nl",
  "fold", "expand", "unexpand", "strings", "split", "column",
  "join", "tee", "find", "basename", "dirname", "tree", "du",
  "env", "printenv", "alias", "unalias", "history", "xargs",
  "true", "false", "clear", "bash", "sh", "jq", "base64", "diff",
  "date", "sleep", "timeout", "seq", "expr", "md5sum", "sha1sum",
  "sha256sum", "file", "html-to-markdown", "help", "which", "tac",
  "hostname", "od", "gzip", "gunzip", "zcat", "tar", "yq", "xan",
  "sqlite3", "time", "whoami",
] as const;

export const JUST_BASH_3_NETWORK_COMMAND_NAMES = ["curl"] as const;
export const JUST_BASH_3_PYTHON_COMMAND_NAMES = ["python3", "python"] as const;
export const JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES = ["js-exec", "node"] as const;
```

## Task 1: Add Compatibility Constants and Command Registry Helpers

**Files:**
- Create: `src/wrapper/compat/just-bash-3.ts`
- Create: `src/wrapper/commands/registry.ts`
- Modify: `src/wrapper/index.ts`
- Modify: `src/wrapper/browser.ts`
- Test: `tests/unit/compat/just-bash-api-surface.test.ts`

- [ ] **Step 1: Write the failing API surface test**

Create `tests/unit/compat/just-bash-api-surface.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import * as moonBash from "../../../src/wrapper/index.ts";
import {
  JUST_BASH_3_COMMAND_NAMES,
  JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES,
  JUST_BASH_3_NETWORK_COMMAND_NAMES,
  JUST_BASH_3_PYTHON_COMMAND_NAMES,
  JUST_BASH_3_ROOT_EXPORTS,
} from "../../../src/wrapper/compat/just-bash-3.ts";

describe("just-bash 3 public API surface", () => {
  it("exports every runtime root symbol required by just-bash 3.0.1", () => {
    const exported = Object.keys(moonBash).sort();
    for (const name of JUST_BASH_3_ROOT_EXPORTS) {
      expect(exported).toContain(name);
    }
  });

  it("reports upstream default command names in upstream order", () => {
    expect(moonBash.getCommandNames()).toEqual([...JUST_BASH_3_COMMAND_NAMES]);
  });

  it("reports optional command groups separately", () => {
    expect(moonBash.getNetworkCommandNames()).toEqual([...JUST_BASH_3_NETWORK_COMMAND_NAMES]);
    expect(moonBash.getPythonCommandNames()).toEqual([...JUST_BASH_3_PYTHON_COMMAND_NAMES]);
    expect(moonBash.getJavaScriptCommandNames()).toEqual([...JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
vp test run tests/unit/compat/just-bash-api-surface.test.ts
```

Expected: FAIL because `src/wrapper/compat/just-bash-3.ts` and `src/wrapper/commands/registry.ts` do not exist and root exports are missing.

- [ ] **Step 3: Add compatibility constants**

Create `src/wrapper/compat/just-bash-3.ts`:

```ts
export const JUST_BASH_3_ROOT_EXPORTS = [
  "Bash",
  "BashTransformPipeline",
  "CommandCollectorPlugin",
  "DefenseInDepthBox",
  "InMemoryFs",
  "MountableFs",
  "NetworkAccessDeniedError",
  "OverlayFs",
  "ReadWriteFs",
  "RedirectNotAllowedError",
  "Sandbox",
  "SandboxCommand",
  "SecurityViolationError",
  "SecurityViolationLogger",
  "TeePlugin",
  "TooManyRedirectsError",
  "bytesOutput",
  "createConsoleViolationCallback",
  "decodeBytesToUtf8",
  "defineCommand",
  "encodeUtf8ToBytes",
  "getCommandNames",
  "getJavaScriptCommandNames",
  "getNetworkCommandNames",
  "getPythonCommandNames",
  "latin1FromBytes",
  "parse",
  "serialize",
  "stdoutAsBytes",
  "stdoutKind",
  "textOutput",
  "unsafeBytesFromLatin1",
] as const;

export const JUST_BASH_3_COMMAND_NAMES = [
  "echo", "cat", "printf", "ls", "mkdir", "rmdir", "touch", "rm",
  "cp", "mv", "ln", "chmod", "pwd", "readlink", "head", "tail",
  "wc", "stat", "grep", "fgrep", "egrep", "rg", "sed", "awk",
  "sort", "uniq", "comm", "cut", "paste", "tr", "rev", "nl",
  "fold", "expand", "unexpand", "strings", "split", "column",
  "join", "tee", "find", "basename", "dirname", "tree", "du",
  "env", "printenv", "alias", "unalias", "history", "xargs",
  "true", "false", "clear", "bash", "sh", "jq", "base64", "diff",
  "date", "sleep", "timeout", "seq", "expr", "md5sum", "sha1sum",
  "sha256sum", "file", "html-to-markdown", "help", "which", "tac",
  "hostname", "od", "gzip", "gunzip", "zcat", "tar", "yq", "xan",
  "sqlite3", "time", "whoami",
] as const;

export const JUST_BASH_3_NETWORK_COMMAND_NAMES = ["curl"] as const;
export const JUST_BASH_3_PYTHON_COMMAND_NAMES = ["python3", "python"] as const;
export const JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES = ["js-exec", "node"] as const;
```

- [ ] **Step 4: Add public command registry helper module**

Create `src/wrapper/commands/registry.ts`:

```ts
import {
  JUST_BASH_3_COMMAND_NAMES,
  JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES,
  JUST_BASH_3_NETWORK_COMMAND_NAMES,
  JUST_BASH_3_PYTHON_COMMAND_NAMES,
} from "../compat/just-bash-3";

export type CommandName = (typeof JUST_BASH_3_COMMAND_NAMES)[number];
export type NetworkCommandName = (typeof JUST_BASH_3_NETWORK_COMMAND_NAMES)[number];
export type PythonCommandName = (typeof JUST_BASH_3_PYTHON_COMMAND_NAMES)[number];
export type JavaScriptCommandName = (typeof JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES)[number];
export type AllCommandName =
  | CommandName
  | NetworkCommandName
  | PythonCommandName
  | JavaScriptCommandName;

export function getCommandNames(): string[] {
  return [...JUST_BASH_3_COMMAND_NAMES];
}

export function getNetworkCommandNames(): string[] {
  return [...JUST_BASH_3_NETWORK_COMMAND_NAMES];
}

export function getPythonCommandNames(): string[] {
  return [...JUST_BASH_3_PYTHON_COMMAND_NAMES];
}

export function getJavaScriptCommandNames(): string[] {
  return [...JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES];
}
```

- [ ] **Step 5: Re-export helpers from root and browser entries**

Modify `src/wrapper/index.ts` near existing exports:

```ts
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
```

Remove the existing local `getCommandNames()` function from `src/wrapper/index.ts` or rename the private command-list helper so there is only one exported `getCommandNames()` symbol.

Modify `src/wrapper/browser.ts` to re-export the upstream browser-safe command-name types and helper functions:

```ts
export type {
  AllCommandName,
  CommandName,
  NetworkCommandName,
} from "./commands/registry";
export {
  getCommandNames,
  getNetworkCommandNames,
} from "./commands/registry";
```

- [ ] **Step 6: Run the test again**

Run:

```bash
vp test run tests/unit/compat/just-bash-api-surface.test.ts
```

Expected: still FAIL because many root runtime exports are not implemented yet. Keep this test; Task 2 adds conservative stubs for this surface.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/wrapper/compat/just-bash-3.ts src/wrapper/commands/registry.ts src/wrapper/index.ts src/wrapper/browser.ts tests/unit/compat/just-bash-api-surface.test.ts
git commit -m "Add just-bash 3 API surface matrix"
```

## Task 2: Add Conservative Runtime Export Stubs

**Files:**
- Create: `src/wrapper/security.ts`
- Create: `src/wrapper/fs.ts`
- Create: `src/wrapper/network.ts`
- Create: `src/wrapper/transform.ts`
- Create: `src/wrapper/parser.ts`
- Modify: `src/wrapper/index.ts`
- Modify: `src/wrapper/browser.ts`
- Test: `tests/unit/compat/just-bash-api-surface.test.ts`

This task intentionally adds API-compatible stubs for future phases. Stubs must be explicit and conservative: they should allow imports and type checks, but throw clear "not implemented in this compatibility slice" errors for behavior that is not yet implemented.

- [ ] **Step 1: Add parser facade stub**

Create `src/wrapper/parser.ts`:

```ts
export interface ScriptNode {
  type: "Script";
  statements: unknown[];
}

export type StatementNode = unknown;
export type PipelineNode = unknown;
export type CommandNode = unknown;
export type SimpleCommandNode = unknown;
export type WordNode = unknown;

export function parse(_script: string): ScriptNode {
  throw new Error("moon-bash: parse() compatibility facade is not implemented yet");
}
```

- [ ] **Step 2: Add transform facade stub**

Create `src/wrapper/transform.ts`:

```ts
import type { ScriptNode } from "./parser";

export interface TransformContext {
  ast: ScriptNode;
  metadata: Record<string, unknown>;
}

export interface TransformResult<TMetadata extends object = Record<string, unknown>> {
  ast: ScriptNode;
  metadata?: TMetadata;
}

export interface TransformPlugin<TMetadata extends object = Record<string, unknown>> {
  name: string;
  transform(context: TransformContext): TransformResult<TMetadata>;
}

export interface BashTransformResult<TMetadata extends object = Record<string, unknown>> {
  script: string;
  ast: ScriptNode;
  metadata: TMetadata;
}

export function serialize(_node: ScriptNode): string {
  throw new Error("moon-bash: serialize() compatibility facade is not implemented yet");
}

export class BashTransformPipeline<TMetadata extends object = Record<string, never>> {
  use<M extends object>(_plugin: TransformPlugin<M>): BashTransformPipeline<TMetadata & M> {
    throw new Error("moon-bash: BashTransformPipeline is not implemented yet");
  }

  transform(_script: string): BashTransformResult<TMetadata> {
    throw new Error("moon-bash: BashTransformPipeline is not implemented yet");
  }
}

export interface CommandCollectorMetadata {
  commands: string[];
}

export class CommandCollectorPlugin implements TransformPlugin<CommandCollectorMetadata> {
  name = "command-collector";

  transform(context: TransformContext): TransformResult<CommandCollectorMetadata> {
    return { ast: context.ast, metadata: { commands: [] } };
  }
}

export interface TeeFileInfo {
  path: string;
  fd: 1 | 2;
}

export interface TeePluginOptions {
  outputDir: string;
}

export interface TeePluginMetadata {
  teeFiles: TeeFileInfo[];
}

export class TeePlugin implements TransformPlugin<TeePluginMetadata> {
  name = "tee";

  constructor(readonly options: TeePluginOptions) {}

  transform(context: TransformContext): TransformResult<TeePluginMetadata> {
    return { ast: context.ast, metadata: { teeFiles: [] } };
  }
}
```

- [ ] **Step 3: Add security facade stub**

Create `src/wrapper/security.ts`:

```ts
export type SecurityViolationType =
  | "blocked-global"
  | "dynamic-code"
  | "process-access"
  | "filesystem-access"
  | "network-access"
  | "unknown";

export interface SecurityViolation {
  type: SecurityViolationType;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface DefenseInDepthConfig {
  enabled?: boolean;
  auditMode?: boolean;
  onViolation?: (violation: SecurityViolation) => void;
}

export interface DefenseInDepthStats {
  violations: number;
}

export interface DefenseInDepthHandle {
  run<T>(fn: () => T | Promise<T>): T | Promise<T>;
  deactivate(): void;
}

export class SecurityViolationError extends Error {
  constructor(message: string, readonly violation?: SecurityViolation) {
    super(message);
    this.name = "SecurityViolationError";
  }
}

export class SecurityViolationLogger {
  readonly violations: SecurityViolation[] = [];

  log(violation: SecurityViolation): void {
    this.violations.push(violation);
  }
}

export class DefenseInDepthBox {
  static getInstance(_config?: DefenseInDepthConfig | boolean): DefenseInDepthBox {
    return new DefenseInDepthBox();
  }

  static isInSandboxedContext(): boolean {
    return false;
  }

  static runTrustedAsync<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  isEnabled(): boolean {
    return false;
  }

  activate(): DefenseInDepthHandle {
    return {
      run: (fn) => fn(),
      deactivate: () => {},
    };
  }

  getStats(): DefenseInDepthStats {
    return { violations: 0 };
  }
}

export function createConsoleViolationCallback(): (violation: SecurityViolation) => void {
  return (violation) => {
    console.warn("moon-bash security violation", violation);
  };
}
```

- [ ] **Step 4: Add filesystem facade stubs**

Create `src/wrapper/fs.ts`:

```ts
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
```

- [ ] **Step 5: Add network facade types and errors**

Create `src/wrapper/network.ts`:

```ts
export interface DnsLookupResult {
  address: string;
  family: number;
}

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS";

export interface RequestTransform {
  headers: Record<string, string>;
}

export interface AllowedUrl {
  url: string;
  transform?: RequestTransform[];
}

export type AllowedUrlEntry = string | AllowedUrl;

export interface NetworkConfig {
  allowedUrlPrefixes?: AllowedUrlEntry[];
  allowedMethods?: HttpMethod[];
  dangerouslyAllowFullInternetAccess?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  maxResponseSize?: number;
  denyPrivateRanges?: boolean;
  _dnsResolve?: (hostname: string) => Promise<DnsLookupResult[]>;
}

export interface FetchResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Uint8Array;
  url: string;
}

export interface SecureFetchOptions {
  method?: string;
  headers?: Headers | Record<string, string>;
  body?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
}

export type SecureFetch = (
  url: string,
  options?: SecureFetchOptions,
) => Promise<FetchResult>;

export class NetworkAccessDeniedError extends Error {
  constructor(url: string, reason = "URL not in allow-list") {
    super(`Network access denied: ${reason}: ${url}`);
    this.name = "NetworkAccessDeniedError";
  }
}

export class TooManyRedirectsError extends Error {
  constructor(maxRedirects: number) {
    super(`Too many redirects (max: ${maxRedirects})`);
    this.name = "TooManyRedirectsError";
  }
}

export class RedirectNotAllowedError extends Error {
  constructor(url: string) {
    super(`Redirect target not in allow-list: ${url}`);
    this.name = "RedirectNotAllowedError";
  }
}
```

- [ ] **Step 6: Add minimal `Sandbox.create` surface**

Modify the existing `Sandbox` class in `src/wrapper/index.ts`:

```ts
export interface SandboxOptions extends BashOptions {
  timeoutMs?: number;
  overlayRoot?: string;
}

export class Sandbox {
  private bash: Bash;

  constructor(options: BashOptions = {}) {
    this.bash = new Bash(options);
  }

  static async create(options: SandboxOptions = {}): Promise<Sandbox> {
    return new Sandbox(options);
  }

  async exec(script: string, options: ExecOptions = {}): Promise<BashExecResult> {
    return this.bash.exec(script, options);
  }

  getFs(): FileSystem {
    return this.bash.getFs();
  }
}

export class SandboxCommand {
  readonly cmdId = crypto.randomUUID();
  readonly startedAt = new Date();
  exitCode: number | undefined;

  async wait(): Promise<this> {
    throw new Error("moon-bash: SandboxCommand is not implemented yet");
  }
}
```

This preserves the existing constructor/`exec()` compatibility while adding the static API required by just-bash consumers. The later Sandbox parity plan replaces `SandboxCommand` with a real command runner.

- [ ] **Step 7: Add transform methods to `Bash`**

Modify `src/wrapper/index.ts` imports:

```ts
import type { TransformPlugin, BashTransformResult } from "./transform";
import { parse } from "./parser";
import { serialize } from "./transform";
```

Add a field to `Bash`:

```ts
private transformPlugins: TransformPlugin[] = [];
```

Add methods to `Bash`:

```ts
registerTransformPlugin(plugin: TransformPlugin): void {
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
```

These methods compile and keep the upstream method names available. They still throw through `parse()`/`serialize()` until the transform/parser parity plan replaces the facade.

- [ ] **Step 8: Re-export stubs from `src/wrapper/index.ts` and `browser.ts`**

Add to `src/wrapper/index.ts`:

```ts
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
  OverlayFs,
  ReadWriteFs,
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
```

Mirror the same safe exports in `src/wrapper/browser.ts`, except do not export `OverlayFs`, `ReadWriteFs`, `Sandbox`, or `SandboxCommand` from the browser entry. Upstream browser entry omits those Node-specific exports.

- [ ] **Step 9: Run API surface test**

Run:

```bash
vp test run tests/unit/compat/just-bash-api-surface.test.ts
```

Expected: PASS for export and command helper checks.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/wrapper/index.ts src/wrapper/browser.ts src/wrapper/parser.ts src/wrapper/transform.ts src/wrapper/security.ts src/wrapper/fs.ts src/wrapper/network.ts tests/unit/compat/just-bash-api-surface.test.ts
git commit -m "Add just-bash 3 public export stubs"
```

## Task 3: Add ByteString and Output Kind Helpers

**Files:**
- Create: `src/wrapper/encoding.ts`
- Modify: `src/wrapper/types.ts`
- Modify: `src/wrapper/index.ts`
- Modify: `src/wrapper/browser.ts`
- Test: `tests/unit/encoding.test.ts`
- Test: `tests/unit/custom-commands.test.ts`

- [ ] **Step 1: Write failing ByteString helper tests**

Create `tests/unit/encoding.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import {
  bytesOutput,
  decodeBytesToUtf8,
  EMPTY_BYTES,
  encodeUtf8ToBytes,
  latin1FromBytes,
  stdoutAsBytes,
  stdoutKind,
  textOutput,
  unsafeBytesFromLatin1,
} from "../../src/wrapper/index.ts";

describe("ByteString compatibility helpers", () => {
  it("round-trips UTF-8 text through byte helpers", () => {
    const bytes = encodeUtf8ToBytes("hello 你好");
    expect(decodeBytesToUtf8(bytes)).toBe("hello 你好");
  });

  it("preserves latin1 byte buffers without decoding when requested", () => {
    const raw = "\x00\xffA";
    const bytes = unsafeBytesFromLatin1(raw);
    expect(latin1FromBytes(bytes)).toBe(raw);
  });

  it("exposes EMPTY_BYTES", () => {
    expect(latin1FromBytes(EMPTY_BYTES)).toBe("");
  });

  it("marks text and bytes output kinds", () => {
    const text = { stdout: "hello", stderr: "", exitCode: 0, ...textOutput("hello") };
    expect(stdoutKind(text)).toBe("text");
    expect(decodeBytesToUtf8(stdoutAsBytes(text))).toBe("hello");

    const raw = unsafeBytesFromLatin1("\x1f\x8b");
    const bytes = { stdout: "\x1f\x8b", stderr: "", exitCode: 0, ...bytesOutput(raw) };
    expect(stdoutKind(bytes)).toBe("bytes");
    expect(latin1FromBytes(stdoutAsBytes(bytes))).toBe("\x1f\x8b");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
vp test run tests/unit/encoding.test.ts
```

Expected: FAIL because `src/wrapper/encoding.ts` does not exist and helpers are not exported.

- [ ] **Step 3: Implement encoding helpers**

Create `src/wrapper/encoding.ts`:

```ts
declare const __byteString: unique symbol;

export interface ByteString {
  readonly [__byteString]: true;
}

export type OutputKind = "text" | "bytes";

const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

export function unsafeBytesFromLatin1(s: string): ByteString {
  return s as unknown as ByteString;
}

export function latin1FromBytes(b: ByteString): string {
  return b as unknown as string;
}

export function decodeBytesToUtf8(b: ByteString): string {
  const s = b as unknown as string;
  if (!s) return s;

  let hasHighByte = false;
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code > 0xff) return s;
    if (code > 0x7f) hasHighByte = true;
  }
  if (!hasHighByte) return s;

  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) {
    bytes[i] = s.charCodeAt(i);
  }

  try {
    return strictUtf8Decoder.decode(bytes);
  } catch {
    return s;
  }
}

export function encodeUtf8ToBytes(s: string): ByteString {
  if (!s) return "" as unknown as ByteString;
  const bytes = utf8Encoder.encode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out as unknown as ByteString;
}

export const EMPTY_BYTES: ByteString = "" as unknown as ByteString;

export function bytesFromUint8Array(buf: Uint8Array): ByteString {
  let out = "";
  for (let i = 0; i < buf.length; i += 1) {
    out += String.fromCharCode(buf[i]);
  }
  return out as unknown as ByteString;
}

export function uint8ArrayFromBytes(bytes: ByteString): Uint8Array {
  const raw = latin1FromBytes(bytes);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i) & 0xff;
  }
  return out;
}

export function stdoutKind(result: { stdoutKind?: OutputKind; stdoutEncoding?: "binary" }): OutputKind {
  if (result.stdoutKind) return result.stdoutKind;
  return result.stdoutEncoding === "binary" ? "bytes" : "text";
}

export function stdoutAsBytes(result: {
  stdout: string;
  stdoutKind?: OutputKind;
  stdoutEncoding?: "binary";
}): ByteString {
  return stdoutKind(result) === "bytes"
    ? unsafeBytesFromLatin1(result.stdout)
    : encodeUtf8ToBytes(result.stdout);
}

export function textOutput(data: string): { stdout: string; stdoutKind: "text" } {
  return { stdout: data, stdoutKind: "text" };
}

export function bytesOutput(data: ByteString): {
  stdout: string;
  stdoutKind: "bytes";
  stdoutEncoding: "binary";
} {
  return {
    stdout: latin1FromBytes(data),
    stdoutKind: "bytes",
    stdoutEncoding: "binary",
  };
}
```

- [ ] **Step 4: Extend result and context types**

Modify `src/wrapper/types.ts`:

```ts
import type { ByteString, OutputKind } from "./encoding";
```

Update `ExecResult`:

```ts
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  stdoutKind?: OutputKind;
  stdoutEncoding?: "binary";
}
```

Update `CommandContext.stdin`:

```ts
stdin: ByteString;
```

- [ ] **Step 5: Re-export helpers from root and browser entries**

Add to `src/wrapper/index.ts` and `src/wrapper/browser.ts`:

```ts
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
```

- [ ] **Step 6: Update custom command tests to decode stdin explicitly**

Modify the `wordcount` test in `tests/unit/custom-commands.test.ts`:

```ts
import { decodeBytesToUtf8 } from "../../src/wrapper/index.ts";
```

Change:

```ts
const words = ctx.stdin.trim().split(/\s+/).filter(Boolean).length;
```

to:

```ts
const words = decodeBytesToUtf8(ctx.stdin).trim().split(/\s+/).filter(Boolean).length;
```

If other tests call string methods on `ctx.stdin`, update them to use `decodeBytesToUtf8(ctx.stdin)` or `latin1FromBytes(ctx.stdin)` depending on intent.

- [ ] **Step 7: Run focused tests**

Run:

```bash
vp test run tests/unit/encoding.test.ts tests/unit/custom-commands.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/wrapper/encoding.ts src/wrapper/types.ts src/wrapper/index.ts src/wrapper/browser.ts tests/unit/encoding.test.ts tests/unit/custom-commands.test.ts
git commit -m "Add ByteString compatibility helpers"
```

## Task 4: Align Command Registration and Optional Command Semantics

**Files:**
- Modify: `src/wrapper/index.ts`
- Modify: `src/lib/commands/registry.mbt`
- Modify: `src/lib/interpreter/interpreter_execution_helpers.mbt`
- Test: `tests/unit/Bash.commands.test.ts`
- Test: `tests/unit/compat/just-bash-api-surface.test.ts`

- [ ] **Step 1: Update command filtering tests for optional groups**

Modify `tests/unit/Bash.commands.test.ts` `getCommandNames returns all available command names` case:

```ts
it("getCommandNames returns upstream default command names without optional groups", () => {
  const names = getCommandNames();
  expect(names).toContain("echo");
  expect(names).toContain("cat");
  expect(names).toContain("ls");
  expect(names).toContain("grep");
  expect(names).toContain("find");
  expect(names).toContain("split");
  expect(names).toContain("strings");
  expect(names).toContain("tar");
  expect(names).toContain("html-to-markdown");
  expect(names).not.toContain("curl");
  expect(names).not.toContain("python3");
  expect(names).not.toContain("python");
  expect(names).not.toContain("js-exec");
  expect(names).not.toContain("node");
});
```

Add tests:

```ts
it("network commands are unavailable until network is configured", async () => {
  const bash = new Bash();
  const result = await bash.exec("curl https://example.com");
  expect(result.exitCode).toBe(127);
  expect(result.stderr).toContain("command not found");
});

it("python alias is registered when python is enabled", async () => {
  const bash = new Bash({ python: true, vm: { run: async (request) => ({
    stdout: `${request.runtime}:${request.args.join(" ")}\n`,
    stderr: "",
    exitCode: 0,
  }) } });
  const result = await bash.exec("python -c 'print(1)'");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("python3:");
});

it("javascript commands are unavailable until javascript is configured", async () => {
  const bash = new Bash();
  const result = await bash.exec("js-exec -c 'console.log(1)'");
  expect(result.exitCode).toBe(127);
  expect(result.stderr).toContain("command not found");
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
vp test run tests/unit/Bash.commands.test.ts tests/unit/compat/just-bash-api-surface.test.ts
```

Expected: FAIL because wrapper allowed commands and optional semantics are not aligned.

- [ ] **Step 3: Replace `DEFAULT_COMMAND_NAMES` usage in wrapper**

Modify `src/wrapper/index.ts`:

```ts
import {
  getCommandNames,
  getJavaScriptCommandNames,
  getNetworkCommandNames,
  getPythonCommandNames,
} from "./commands/registry";
```

Remove the local `DEFAULT_COMMAND_NAMES` array and update `installDefaultBinStubs()`:

```ts
for (const commandName of this.getRegisteredCommandNamesForLayout()) {
  const stubPath = `/bin/${commandName}`;
  if (!Object.prototype.hasOwnProperty.call(this.files, stubPath)) {
    this.files[stubPath] = `${DEFAULT_BIN_STUB_PREFIX}${commandName}\n`;
  }
  if (!Object.prototype.hasOwnProperty.call(this.modes, stubPath)) {
    this.modes[stubPath] = executableMode;
  }
}
```

Add private helper in `Bash`:

```ts
private getRegisteredCommandNamesForLayout(): string[] {
  const names = new Set<string>(getCommandNames());
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
```

Add a small adapter for upstream `BashOptions.fetch` in `src/wrapper/index.ts`:

```ts
private uint8ArrayToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}
```

Update `createFetchBridge()` to enable the bridge when either `fetch` or `network` is configured:

```ts
private createFetchBridge(): MoonBashFetchBridge | undefined {
  const secureFetch = this.options.fetch;
  const networkOptions = this.options.network;
  if (!secureFetch && !networkOptions) {
    return undefined;
  }

  const fetchImpl = secureFetch
    ? async (request: MoonBashFetchRequest): Promise<MoonBashFetchResponse> => {
        const response = await secureFetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: this.uint8ArrayToLatin1(response.body),
        };
      }
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
```

Full allow-list enforcement for `network: NetworkConfig` remains in the later runtime parity plan; this slice preserves existing `network` behavior and adds the upstream `fetch` hook.

Update `exec()` command allowlist construction:

```ts
const registeredNames = this.getRegisteredCommandNamesForLayout();
const allowed = Array.isArray(this.options.commands)
  ? [...this.options.commands]
  : registeredNames;
if (this.hasCustomCommands()) {
  allowed.push("__moon_bash_custom__");
}
effectiveEnv.__MOON_BASH_ALLOWED_COMMANDS = allowed.join(",");
```

This makes optional commands unavailable unless their options are enabled.

Modify `src/lib/interpreter/interpreter_execution_helpers.mbt` so shell builtins remain usable even though public command names now exclude them:

```moonbit
fn ExecContext::command_allowed(self : ExecContext, name : String) -> Bool {
  if name == "cd" || is_lookup_shell_builtin(name) {
    return true
  }
  match self.env.get("__MOON_BASH_ALLOWED_COMMANDS") {
    None => true
    Some(spec) => {
      if spec.length() == 0 {
        return false
      }
      let allowed = split_string_by_delimiter(spec, ",")
      for i = 0; i < allowed.length(); i = i + 1 {
        if allowed[i] == name {
          return true
        }
      }
      false
    }
  }
}
```

- [ ] **Step 4: Add MoonBit aliases for Python and JavaScript placeholders**

Modify `src/lib/commands/registry.mbt`:

```moonbit
"python3" | "python" => Some(cmd_python3)
"js-exec" | "node" => Some(cmd_js_exec_placeholder)
```

Add `cmd_js_exec_placeholder` to `src/lib/commands/vm.mbt`:

```moonbit
pub fn cmd_js_exec_placeholder(ctx : CommandContext) -> @ast.ExecResult {
  let display_name = if ctx.args.length() > 0 { ctx.args[0] } else { "js-exec" }
  {
    stdout: "",
    stderr: "\{display_name}: JavaScript runtime bridge is not implemented yet\n",
    exit_code: 1,
  }
}
```

The wrapper allowlist keeps these commands unavailable unless `BashOptions.javascript` is configured. This placeholder exists only so enabled JavaScript command names resolve deterministically until the runtime parity plan replaces it.

- [ ] **Step 5: Run MoonBit check**

Run:

```bash
moon -C src check --target js
```

Expected: PASS.

- [ ] **Step 6: Run focused TS tests**

Run:

```bash
moon -C src build --target js --release
vp test run tests/unit/Bash.commands.test.ts tests/unit/compat/just-bash-api-surface.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/wrapper/index.ts src/lib/commands/registry.mbt src/lib/commands/vm.mbt tests/unit/Bash.commands.test.ts tests/unit/compat/just-bash-api-surface.test.ts
git commit -m "Align command registration with just-bash 3"
```

## Task 5: Implement Low-risk ExecOptions 3.0 Fields

**Files:**
- Modify: `src/wrapper/types.ts`
- Modify: `src/wrapper/index.ts`
- Modify: `src/lib/interpreter/interpreter.mbt`
- Modify: `src/lib/interpreter/interpreter_execution.mbt`
- Modify: `src/lib/interpreter/interpreter_execution_helpers.mbt`
- Create: `src/lib/interpreter/json_bridge.mbt`
- Test: `tests/unit/Bash.exec-options-3.test.ts`

- [ ] **Step 1: Write failing exec option tests**

Create `tests/unit/Bash.exec-options-3.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { Bash, latin1FromBytes, unsafeBytesFromLatin1 } from "../../src/wrapper/index.ts";

describe("just-bash 3 ExecOptions compatibility", () => {
  it("replaceEnv starts with an empty environment plus provided env", async () => {
    const bash = new Bash({ env: { KEEP: "base" } });
    const result = await bash.exec("printenv KEEP; printenv ONLY", {
      replaceEnv: true,
      env: { ONLY: "exec" },
    });
    expect(result.stdout).not.toContain("base");
    expect(result.stdout).toContain("exec");
  });

  it("args are appended to the first command without shell expansion", async () => {
    const bash = new Bash();
    const result = await bash.exec("printf '%s\\n'", {
      args: ["a b", "*.ts", "$HOME", "semi;colon"],
    });
    expect(result.stdout).toBe("a b\n*.ts\n$HOME\nsemi;colon\n");
  });

  it("stdinKind bytes forwards latin1 byte buffers without UTF-8 re-encoding", async () => {
    const bash = new Bash();
    const raw = latin1FromBytes(unsafeBytesFromLatin1("\x00\xffA"));
    const result = await bash.exec("wc -c", { stdin: raw, stdinKind: "bytes" });
    expect(result.stdout.trim()).toBe("3");
  });

  it("stdinKind text encodes Unicode as UTF-8 bytes", async () => {
    const bash = new Bash();
    const result = await bash.exec("wc -c", { stdin: "你好" });
    expect(result.stdout.trim()).toBe("6");
  });

  it("aborted signal returns timeout-style cancellation result before execution", async () => {
    const bash = new Bash();
    const controller = new AbortController();
    controller.abort();
    const result = await bash.exec("echo should-not-run", { signal: controller.signal });
    expect(result.exitCode).toBe(124);
    expect(result.stdout).toBe("");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
vp test run tests/unit/Bash.exec-options-3.test.ts
```

Expected: FAIL because these options are not implemented.

- [ ] **Step 3: Extend `ExecOptions` type**

Modify `src/wrapper/types.ts`:

```ts
export interface ExecOptions {
  env?: Record<string, string>;
  replaceEnv?: boolean;
  cwd?: string;
  rawScript?: boolean;
  stdin?: string;
  stdinKind?: "text" | "bytes";
  signal?: AbortSignal;
  args?: string[];
}
```

- [ ] **Step 4: Extend `BashOptions` network and JavaScript types**

Add imports to `src/wrapper/types.ts`:

```ts
import type { NetworkConfig, SecureFetch } from "./network";
```

Add `JavaScriptConfig`:

```ts
export interface JavaScriptConfig {
  bootstrap?: string;
  invokeTool?: (path: string, argsJson: string) => Promise<string>;
}
```

Update `BashOptions`:

```ts
export interface BashOptions {
  env?: Record<string, string>;
  cwd?: string;
  files?: InitialFiles;
  fs?: unknown;
  python?: boolean;
  sqlite?: boolean;
  javascript?: boolean | JavaScriptConfig;
  fetch?: SecureFetch;
  network?: NetworkConfig;
  defenseInDepth?: boolean | import("./security").DefenseInDepthConfig;
  limits?: Partial<ExecutionLimits>;
  executionLimits?: Partial<ExecutionLimits>;
  maxCallDepth?: number;
  maxCommandCount?: number;
  maxLoopIterations?: number;
  commands?: string[];
  customCommands?: CustomCommand[];
  sleep?: (durationMs: number) => void | Promise<void>;
  logger?: BashLogger;
  coverage?: FeatureCoverageWriter;
  trace?: unknown;
  timers?: TimerOptions;
  vm?: VmOptions;
}
```

Keep existing MoonBash-only fields such as `sqlite`, `limits`, `coverage`, `timers`, and `vm`; this task adds upstream-compatible fields without removing local compatibility.

- [ ] **Step 5: Implement wrapper-side env and abort behavior**

Modify `src/wrapper/index.ts` in `Bash.exec()`:

```ts
if (execOptions.signal?.aborted) {
  return {
    stdout: "",
    stderr: "",
    exitCode: 124,
    env: execOptions.replaceEnv ? { ...(execOptions.env ?? {}) } : { ...this.baseEnv, ...execOptions.env },
  };
}

const effectiveEnv: Record<string, string> = execOptions.replaceEnv
  ? { ...(execOptions.env ?? {}) }
  : { ...this.baseEnv, ...execOptions.env };
```

Preserve existing logger behavior.

- [ ] **Step 6: Implement stdin encoding before MoonBit execution**

Add imports:

```ts
import { encodeUtf8ToBytes, latin1FromBytes } from "./encoding";
```

Replace the shell-prelude stdin injection:

```ts
if (typeof execOptions.stdin === "string" && execOptions.stdin.length > 0) {
  scriptToRun = `printf '%s' ${shellSingleQuote(execOptions.stdin)} | {\n${scriptToRun}\n}`;
}
```

with:

```ts
const stdinContent =
  execOptions.stdin === undefined
    ? ""
    : execOptions.stdinKind === "bytes"
      ? execOptions.stdin
      : latin1FromBytes(encodeUtf8ToBytes(execOptions.stdin));
```

Pass `stdinContent` to MoonBit by adding a temporary env field:

```ts
if (stdinContent.length > 0) {
  effectiveEnv.__MOON_BASH_STDIN = stdinContent;
}
```

This is an interim bridge. A later kernel cleanup can replace it with an explicit `execute_with_state` parameter.

- [ ] **Step 7: Implement first-command args bridge**

In `Bash.exec()`, add:

```ts
if (execOptions.args && execOptions.args.length > 0) {
  effectiveEnv.__MOON_BASH_EXTRA_ARGS = JSON.stringify(execOptions.args);
}
```

Create `src/lib/interpreter/json_bridge.mbt`:

```moonbit
fn json_bridge_string_array(raw : String) -> Array[String] {
  let out : Array[String] = []
  let parsed = @json.parse(raw[:]) catch {
    _ => return out
  }
  match parsed {
    Json::Array(items) => {
      for item in items {
        match item {
          Json::String(s) => out.push(s)
          Json::Number(n, ..) => out.push(n.to_int().to_string())
          Json::True => out.push("true")
          Json::False => out.push("false")
          Json::Null => out.push("")
          _ => out.push(item.stringify(indent=0))
        }
      }
    }
    _ => ()
  }
  out
}
```

Add `moonbitlang/core/json` to `src/lib/interpreter/moon.pkg.json`:

```json
{
  "import": [
    "Haoxincode/moonbash/lib/ast",
    "Haoxincode/moonbash/lib/parser",
    "Haoxincode/moonbash/lib/fs",
    "Haoxincode/moonbash/lib/commands",
    "Haoxincode/moonbash/lib/regex",
    "Haoxincode/moonbash/lib/ffi",
    "moonbitlang/core/json",
    "moonbitlang/x/time"
  ]
}
```

Add this helper to `src/lib/interpreter/interpreter_execution_helpers.mbt`:

```moonbit
fn ExecContext::consume_extra_args(self : ExecContext) -> Array[String] {
  match self.env.get("__MOON_BASH_EXTRA_ARGS") {
    None => []
    Some(raw) => {
      self.env.remove("__MOON_BASH_EXTRA_ARGS")
      json_bridge_string_array(raw)
    }
  }
}
```

Modify `src/lib/interpreter/interpreter_execution.mbt` immediately after the `args` array is built:

```moonbit
  let extra_args = self.consume_extra_args()
  for arg in extra_args {
    args.push(arg)
  }
```

Because `consume_extra_args()` removes the env key, only the first simple command in the script receives these extra argv values.

- [ ] **Step 8: Wire `__MOON_BASH_STDIN` into execution context**

Modify `src/lib/interpreter/interpreter.mbt` in `ExecContext::new`. Before returning the record, extract and remove the bridge value:

```moonbit
  let initial_stdin = default_env.get("__MOON_BASH_STDIN").unwrap_or("")
  default_env.remove("__MOON_BASH_STDIN")
```

Change the record field:

```moonbit
    stdin_buf: initial_stdin,
```

- [ ] **Step 9: Validate MoonBit**

Run:

```bash
moon -C src check --target js
```

Expected: PASS.

- [ ] **Step 10: Run focused exec tests**

Run:

```bash
moon -C src build --target js --release
vp test run tests/unit/Bash.exec-options-3.test.ts tests/unit/Bash.exec-options.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```bash
git add src/wrapper/types.ts src/wrapper/index.ts src/lib/interpreter/moon.pkg.json src/lib/interpreter/interpreter.mbt src/lib/interpreter/interpreter_execution.mbt src/lib/interpreter/interpreter_execution_helpers.mbt src/lib/interpreter/json_bridge.mbt tests/unit/Bash.exec-options-3.test.ts
git commit -m "Implement just-bash 3 exec option compatibility"
```

## Task 6: Add Type Compile Compatibility Checks

**Files:**
- Create: `tests/unit/compat/just-bash-types.compile.ts`
- Create: `tsconfig.compat.json`
- Modify: `package.json` only if adding a new script is acceptable in the current branch

- [ ] **Step 1: Create compile-only consumer fixture**

Create `tests/unit/compat/just-bash-types.compile.ts`:

```ts
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
  type ExecOptions,
  type IFileSystem,
  type JavaScriptConfig,
  type NetworkConfig,
  type SecureFetch,
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
new MountableFs({ base: fs });
new OverlayFs({ root: process.cwd() });
new ReadWriteFs({ root: process.cwd() });

const ast = parse("echo hello");
serialize(ast);
new BashTransformPipeline().use(new TeePlugin({ outputDir: "/tmp" })).transform("echo hello");

DefenseInDepthBox.isInSandboxedContext();
void Sandbox.create({ cwd: "/home/user" });
```

- [ ] **Step 2: Create compatibility tsconfig**

Create `tsconfig.compat.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."
  },
  "include": [
    "src/wrapper/**/*.ts",
    "tests/unit/compat/just-bash-types.compile.ts"
  ]
}
```

- [ ] **Step 3: Run compile check**

Run:

```bash
vp exec tsc -p tsconfig.compat.json
```

Expected: PASS after Tasks 1-5. If `vp exec` is not available, run:

```bash
pnpm exec tsc -p tsconfig.compat.json
```

- [ ] **Step 4: Optionally add script**

If this branch is allowed to touch `package.json`, add:

```json
"test:compat:types": "tsc -p tsconfig.compat.json"
```

Do not edit `package.json` if it has unrelated user changes that make conflict risk high; the standalone command is enough for this phase.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/unit/compat/just-bash-types.compile.ts tsconfig.compat.json package.json
git commit -m "Add just-bash type compatibility compile check"
```

If `package.json` was not edited, omit it from `git add`.

## Task 7: Update Alignment Documentation

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/COMMANDS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/superpowers/specs/2026-05-16-just-bash-3-api-compat-design.md`

- [ ] **Step 1: Update docs to distinguish implemented slice from future phases**

In `docs/API.md`, add a status note near the top:

```md
Status note (2026-05-16): MoonBash is aligning to `just-bash@3.0.1`. The first compatibility slice covers root exports, command-name helpers, ByteString helpers, and low-risk `ExecOptions`. Full FS, Sandbox, Transform, JavaScript runtime, and executor compatibility are planned in separate implementation phases.
```

In `docs/COMMANDS.md`, change "87 Unix commands" language to:

```md
MoonBash tracks the `just-bash@3.0.1` public command surface: 82 default command names plus optional network, Python, and JavaScript command groups. Shell builtins may add additional Bash-compatible names that are not part of `getCommandNames()`.
```

In `docs/ROADMAP.md`, add a Phase 6 section:

```md
Phase 6: just-bash 3 API Compatibility 🔧 IN PROGRESS
  → Surface parity matrix, command-name helpers, ByteString helpers, ExecOptions compatibility
  → Remaining: async FS classes, Sandbox, Transform, js-exec/node, executor companion, CJS/browser packaging parity
```

Update the spec if implementation choices changed during Tasks 1-6.

- [ ] **Step 2: Run docs diff review**

Run:

```bash
git diff -- docs/API.md docs/COMMANDS.md docs/ROADMAP.md docs/superpowers/specs/2026-05-16-just-bash-3-api-compat-design.md
```

Expected: docs describe status accurately and do not claim full compatibility is complete.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/API.md docs/COMMANDS.md docs/ROADMAP.md docs/superpowers/specs/2026-05-16-just-bash-3-api-compat-design.md
git commit -m "Document just-bash 3 compatibility status"
```

## Task 8: Final Verification for Surface Parity Slice

**Files:**
- No code changes expected.

- [ ] **Step 1: Run MoonBit check**

Run:

```bash
moon -C src check --target js
```

Expected: PASS.

- [ ] **Step 2: Run targeted tests**

Run:

```bash
moon -C src build --target js --release
vp test run tests/unit/compat/just-bash-api-surface.test.ts tests/unit/encoding.test.ts tests/unit/Bash.commands.test.ts tests/unit/Bash.exec-options-3.test.ts tests/unit/custom-commands.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type compatibility compile check**

Run:

```bash
vp exec tsc -p tsconfig.compat.json
```

Expected: PASS. If `vp exec` is unavailable, use `pnpm exec tsc -p tsconfig.compat.json`.

- [ ] **Step 4: Run safe suite**

Run:

```bash
vp run test:safe
```

Expected: PASS. If it fails, inspect whether failures are from this compatibility slice or existing unrelated dirty-worktree changes. Do not claim the slice complete until related failures are fixed.

- [ ] **Step 5: Record remaining phases**

Open `docs/superpowers/specs/2026-05-16-just-bash-3-api-compat-design.md` and confirm the remaining phases are still listed:

- FS classes.
- Sandbox API.
- Transform/parser facade.
- JavaScript runtime and `js-exec`/`node`.
- Executor companion.
- Packaging parity, including CJS if required.

- [ ] **Step 6: Commit verification note if needed**

If tests required docs updates, commit them:

```bash
git add docs/ROADMAP.md docs/superpowers/specs/2026-05-16-just-bash-3-api-compat-design.md
git commit -m "Record just-bash surface parity verification"
```

If no files changed, do not create an empty commit.

## Self-review

Spec coverage:

- Public API matrix: covered by Tasks 1, 2, and 6.
- Command-name parity and optional groups: covered by Tasks 1 and 4.
- ByteString helpers: covered by Task 3.
- Low-risk `ExecOptions`: covered by Task 5.
- Docs alignment: covered by Task 7.
- Full FS, Sandbox, Transform, `js-exec`, executor, packaging parity: intentionally deferred but explicitly listed as follow-up plans, because each is a separate subsystem from the approved design.

Placeholder scan:

- Placeholder scan passed: no implementation step contains unresolved filler or vague test instructions.
- Stub exports are explicitly conservative and named as temporary compatibility facades.

Type consistency:

- `ByteString`, `OutputKind`, `ExecOptions`, command helper names, and class names match the approved design and upstream public names.

## Next Plans After This Slice

After this plan is complete, write and execute separate plans in this order:

1. `just-bash-3-filesystem-parity`: async `IFileSystem`, `InMemoryFs`, `MountableFs`, `OverlayFs`, `ReadWriteFs`, lazy files, binary reads.
2. `just-bash-3-sandbox-parity`: `Sandbox.create`, `runCommand`, `SandboxCommand`, streams, timeout, cancellation.
3. `just-bash-3-transform-parity`: MoonBit AST JSON or TS parser facade, parse/serialize, transform plugins.
4. `just-bash-3-runtime-parity`: `javascript`, `js-exec`, `node`, `invokeTool`, worker bridge, Python/SQLite option semantics.
5. `just-bash-3-executor-companion`: executor API and bash tool command generation.
6. `just-bash-3-packaging-parity`: browser subpath, CJS if required, CLI if required, export map checks.
