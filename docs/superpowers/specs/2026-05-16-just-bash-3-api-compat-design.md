# just-bash 3 API Compatibility Design

## Goal

MoonBash will align with the current upstream `just-bash` public API, using `just-bash@3.0.1` and `@just-bash/executor@1.0.2` as the compatibility baseline verified on 2026-05-16. The target is 100% public API compatibility where a consumer can replace imports from `just-bash` with MoonBash without TypeScript or runtime API breakage, while MoonBash keeps pure shell computation inside the MoonBit kernel.

## Compatibility Scope

The target scope is every public export from `just-bash@3.0.1`:

- `Bash`, `BashOptions`, `ExecOptions`, `BashExecResult`, `ExecResult`, `Command`, `CommandContext`, `CustomCommand`, `LazyCommand`.
- Command-name types and helpers: `CommandName`, `NetworkCommandName`, `PythonCommandName`, `JavaScriptCommandName`, `AllCommandName`, `getCommandNames()`, `getNetworkCommandNames()`, `getPythonCommandNames()`, `getJavaScriptCommandNames()`.
- Byte/text boundary API: `ByteString`, `OutputKind`, `EMPTY_BYTES`, `unsafeBytesFromLatin1()`, `latin1FromBytes()`, `decodeBytesToUtf8()`, `encodeUtf8ToBytes()`, `stdoutKind()`, `stdoutAsBytes()`, `textOutput()`, `bytesOutput()`.
- Filesystem API: `IFileSystem`, `InMemoryFs`, `MountableFs`, `OverlayFs`, `ReadWriteFs`, related option and entry types, lazy initial files, binary reads, symlink and realpath behavior.
- Parser and transform API: AST node types, `parse()`, `serialize()`, `BashTransformPipeline`, `TransformPlugin`, `CommandCollectorPlugin`, `TeePlugin`.
- Vercel Sandbox-compatible API: `Sandbox`, `SandboxCommand`, `SandboxOptions`, `CommandFinished`, `OutputMessage`, `WriteFilesInput`.
- Security API: `DefenseInDepthBox`, `DefenseInDepthConfig`, `DefenseInDepthHandle`, `DefenseInDepthStats`, `SecurityViolation`, `SecurityViolationLogger`, `SecurityViolationError`, `createConsoleViolationCallback()`.
- Optional runtime API: `network`/`fetch`, `python`, `javascript`, `javascript.invokeTool`, `js-exec`, `node`, `sqlite3`, timers, cancellation, and worker bridge semantics.
- Companion executor integration compatible with `@just-bash/executor@1.0.2`, either as a separate MoonBash companion package or a clearly separated TS-layer module.

MoonBash may expose additional APIs, but those additions must not change or weaken `just-bash`-compatible behavior.

## Architecture

MoonBash keeps a fat MoonBit kernel and a deliberately broader TypeScript compatibility facade.

The MoonBit kernel owns shell semantics: lexing, parsing, expansion, interpretation, pure command implementations, command registry, in-memory VFS state, execution limits, and pure data processing. It should not absorb host-specific APIs such as physical filesystem access, worker-thread orchestration, QuickJS/CPython/sql.js lifecycle management, or Vercel Sandbox object modeling.

The TypeScript facade owns public API compatibility: exact export names, option types, filesystem classes that require host I/O, byte/text helper functions, Sandbox object lifecycle, transform plugin classes, optional runtime wiring, worker protocols, package exports, browser/node split behavior, and executor tool plumbing. This is the compatibility boundary, not business logic for pure commands.

The FFI boundary remains explicit. Network, timers, optional JS/Python/SQLite runtimes, custom commands, and physical disk access cross through typed bridges. Every bridge must be disabled or unavailable by default when upstream disables it by default.

## Current Baseline

As of the design date:

- `just-bash` npm `latest` is `3.0.1`; `@just-bash/executor` npm `latest` is `1.0.2`.
- MoonBash already has broad command coverage in MoonBit, including many pure text/data/archive commands.
- MoonBash wrapper command defaults and core dispatch are not fully aligned with upstream public command names. Missing or special-case names include `js-exec`, `node`, `python`, and wrapper registration gaps for commands already implemented in the core.
- MoonBash wrapper types do not yet match the `just-bash@3.0.1` public TypeScript surface. Key gaps include `ExecOptions.replaceEnv`, `ExecOptions.stdinKind`, `ExecOptions.args`, `ExecOptions.signal`, byte/text helpers, richer command context fields, async `IFileSystem`, Sandbox, Transform, and security exports.
- Existing docs mention some compatible APIs that are not fully implemented. The implementation and docs must converge on the `just-bash@3.0.1` target.

## Design Decisions

### 1. Public API parity is measured at the TypeScript entry point

The public API contract is the built package entry point, not only MoonBit behavior. A compatibility test must import from MoonBash and from `just-bash@3.0.1`, compare runtime export keys, and compile representative TypeScript consumers against MoonBash types.

### 2. Command parity includes optional command registration semantics

Default pure commands should be available as upstream makes them available. Network commands are registered only when network or fetch configuration enables them. Python commands are registered only when `python: true` enables them. JavaScript commands are registered when `javascript` is enabled or `javascript.invokeTool` is provided. Browser bundles must omit host-only commands in the same way upstream does.

`python` is an alias of `python3`. `node` is a stub or alias for `js-exec` behavior matching upstream. `js-exec` is in scope even though it is a host runtime bridge rather than MoonBit pure logic.

### 3. ByteString migration follows upstream 3.0 semantics

Pipelines carry bytes. The TS public API must expose opaque `ByteString` helpers and output-kind helpers. `ExecOptions.stdinKind` defaults to `"text"` and UTF-8 encodes user text into byte-shaped stdin. `"bytes"` forwards a latin1-shaped byte buffer unchanged. Custom commands receive byte-shaped stdin and must explicitly decode with `decodeBytesToUtf8()` or forward with `latin1FromBytes()`.

MoonBit may continue representing bytes as strings internally where the JS backend requires it, but the wrapper boundary must use the upstream helper semantics and test cases.

### 4. Filesystem compatibility is implemented in TypeScript first

The `IFileSystem` public contract is async and richer than the current wrapper `FileSystem` facade. Implement public TS filesystem classes in the wrapper layer:

- `InMemoryFs`: async API, lazy files, binary reads, symlinks, hard links, lstat/stat/realpath, chmod, utimes, directory entries, and path resolution.
- `MountableFs`: path router over multiple `IFileSystem` implementations with cross-mount copy/move semantics matching upstream tests.
- `OverlayFs`: copy-on-write view over host disk, read-only mode, sanitization, and no writes to trusted runtime code.
- `ReadWriteFs`: direct host-disk access under a configured root with path containment checks.

The MoonBit kernel still receives serialized snapshots for pure execution where practical. Host FS implementations may use TS bridge operations when a command or runtime needs live async FS behavior.

### 5. Sandbox is a TS object model over Bash

`Sandbox.create()` constructs a Bash instance with compatible options. `runCommand()` supports object, string+args, legacy string+options, detached, stdout/stderr writable streams, timeout, cancellation, and `sudo` no-op semantics. The returned `SandboxCommand` exposes `stdout()`, `stderr()`, `output()`, `logs()`, `wait()`, and `kill()`.

### 6. Transform API needs an AST adapter

`parse()`, `serialize()`, and transform plugins must expose the upstream AST shape. There are two acceptable implementation paths:

- Add MoonBit AST JSON export and convert to/from the upstream TS AST shape.
- Maintain a TS parser/serializer compatibility layer derived from upstream where needed.

The preferred path is MoonBit AST JSON plus a TS adapter, because it keeps the parser source of truth in MoonBit. If that blocks exact API compatibility, a TS compatibility parser may be added as a temporary facade with tests requiring equivalence to MoonBit execution for supported syntax.

### 7. `js-exec` and executor are optional runtime bridges

`js-exec` uses a TS worker/runtime bridge. QuickJS and tool invocation are host concerns and must not enter the MoonBit kernel. The MoonBit command registry can route `js-exec` and `node` through the VM bridge, or the TS facade can intercept those commands before MoonBit execution. The selected implementation must preserve shell integration: pipelines, redirections, cwd, env, VFS access, network bridge, timeouts, and output byte handling.

Executor compatibility is a separate module or package that produces:

- `invokeTool(path, argsJson)` for `javascript.invokeTool`.
- `customCommands` for bash namespace commands.
- Argument parsing compatible with `@just-bash/executor@1.0.2`, including key-value args, `--key value`, `--key=value`, `--json`, JSON stdin, kebab-case aliases, approval hooks, and elicitation hooks.

### 8. Security compatibility is exported, but architecture remains explicit

MoonBash should export the same security classes and types. If full monkey-patching behavior is not yet implemented, the initial implementation must be conservative and documented as a compatibility shim, then hardened to match upstream tests. Public APIs must not silently claim stronger security behavior than they enforce.

## Implementation Phases

### Phase A: Baseline and API Matrix

- Create a generated compatibility matrix from `just-bash@3.0.1` exports, command names, option fields, and package exports.
- Add tests that fail when MoonBash misses an upstream export or command helper result.
- Update docs to name `just-bash@3.0.1` as the current target.

### Phase B: Low-risk Surface Parity

- Add missing command names and aliases: wrapper registration gaps, `python`, `js-exec`, `node`.
- Add `getNetworkCommandNames()`, `getPythonCommandNames()`, `getJavaScriptCommandNames()`, and command-name type exports.
- Update `BashOptions` and `ExecOptions` types to match upstream fields, preserving existing MoonBash aliases only as additions.
- Export byte/text helper functions and update custom command types.

### Phase C: Exec and Byte Semantics

- Implement `replaceEnv`, `stdinKind`, `args`, and `signal` behavior.
- Move stdin piping away from shell string prelude toward an explicit execution input channel so bytes and leading whitespace are preserved.
- Update command bridge handling for custom commands and VM commands to carry output kind and byte-shaped stdin.
- Import upstream UTF-8 and binary stdin tests.

### Phase D: Filesystem Classes

- Implement async `IFileSystem` and public FS classes in focused TS files under `src/wrapper/fs/`.
- Make `Bash` accept upstream-compatible `fs?: IFileSystem`.
- Bridge live FS state to the MoonBit kernel for commands that can still run as pure snapshot execution.
- Add upstream FS security and cross-FS tests.

### Phase E: Sandbox API

- Implement `src/wrapper/sandbox/Command.ts` and `src/wrapper/sandbox/Sandbox.ts`.
- Export `Sandbox`, `SandboxCommand`, and related types from the package entry.
- Add upstream Sandbox tests.

### Phase F: Transform and Parser Facade

- Add AST export support from MoonBit or a TS compatibility parser facade.
- Implement `parse()`, `serialize()`, `BashTransformPipeline`, `CommandCollectorPlugin`, and `TeePlugin`.
- Wire `Bash.registerTransformPlugin()` and `Bash.transform()` to the facade.

### Phase G: Optional Runtime Bridges

- Implement `javascript` option, `JavaScriptConfig`, `js-exec`, `node`, `invokeTool`, QuickJS worker bridge, and Node/browser exclusions.
- Align Python and SQLite registration semantics with upstream.
- Add worker timeout, output limit, network, and tool invocation tests.

### Phase H: Executor Companion

- Add a separate compatibility module or package for executor integration.
- Implement inline tools, SDK-driven discovery adapter hooks where available, approval/elicitation hooks, and bash command generation.
- Add executor example and docs tests.

### Phase I: Packaging and Verification

- Match package exports for root and browser entry points.
- Verify Node ESM, CJS if supported, browser bundle, CLI if supported, and type declarations.
- Run `moon -C src check --target js`, `vp run test:safe`, targeted upstream compatibility tests, and generated API matrix tests.

## Testing Strategy

The compatibility suite must include:

- Runtime export-key comparison against `just-bash@3.0.1`.
- TypeScript compile tests for upstream README examples.
- Command-name helper tests for default, network, python, and javascript command groups.
- Upstream `Bash.exec-options`, `Bash.exec-args-forwarding`, `encoding-pipeline`, `utf8-bytestring`, custom command, FS, Sandbox, Transform, `js-exec`, and executor tests where feasible.
- Existing MoonBash comparison, spec, and security tests to prevent regressions.

Passing a narrow MoonBash comparison suite is not enough to claim API compatibility. Completion requires both upstream public API parity and MoonBash behavioral regression coverage.

## Non-goals

- Do not reimplement pure command algorithms in TypeScript when they already belong in MoonBit.
- Do not push pure data processing commands to JS FFI.
- Do not make optional host capabilities available by default when upstream disables them by default.
- Do not remove existing MoonBash APIs solely because upstream lacks them, unless they conflict with compatibility.

## Open Questions

1. Package naming for executor compatibility: publish a separate `@moon-bash/executor` package or expose an internal `moon-bash/executor` subpath.
2. Browser support target for optional runtime APIs: match upstream exclusions exactly or expose MoonBash-specific browser fallbacks where safe.
3. CJS output target: upstream ships CJS; MoonBash currently focuses on ESM. Full API/package compatibility may require adding CJS packaging.
4. Transform parser source of truth: MoonBit AST adapter preferred, TS parser facade acceptable if exact upstream AST compatibility blocks progress.

