import { decodeBytesToUtf8 } from "./encoding";
import type { Command } from "./types";

export interface ExecutorToolDef {
  description?: string;
  execute: (...args: any[]) => unknown;
}

export interface ExecutorElicitationContext {
  readonly toolId: string;
  readonly args: unknown;
  readonly request:
    | {
        readonly _tag: "FormElicitation";
        readonly message: string;
        readonly requestedSchema: Record<string, unknown>;
      }
    | {
        readonly _tag: "UrlElicitation";
        readonly message: string;
        readonly url: string;
        readonly elicitationId: string;
      };
}

export interface ExecutorElicitationResponse {
  readonly action: "accept" | "decline" | "cancel";
  readonly content?: Record<string, unknown>;
}

export type ExecutorElicitationHandler = (
  ctx: ExecutorElicitationContext,
) => Promise<ExecutorElicitationResponse>;

export interface ExecutorSDKHandle {
  tools: {
    list: (filter?: { sourceId?: string; query?: string }) => Promise<readonly unknown[]>;
    invoke: (toolId: string, args: unknown) => Promise<unknown>;
  };
  sources: {
    add: (input: Record<string, unknown>) => Promise<void>;
    list: () => Promise<readonly unknown[]>;
  };
  close: () => Promise<void>;
}

export interface ExecutorApprovalRequest {
  toolPath: string;
  sourceId: string;
  sourceName: string;
  operationKind: "read" | "write" | "delete" | "execute" | "unknown";
  args: unknown;
  reason: string;
  approvalLabel: string | null;
}

export type ExecutorApprovalResponse =
  | { approved: true }
  | { approved: false; reason?: string };

export interface ExecutorConfig {
  tools?: Record<string, ExecutorToolDef>;
  setup?: (sdk: ExecutorSDKHandle) => Promise<void>;
  plugins?: any[];
  onToolApproval?:
    | "allow-all"
    | "deny-all"
    | ((request: ExecutorApprovalRequest) => Promise<ExecutorApprovalResponse>);
  onElicitation?: ExecutorElicitationHandler | "accept-all";
  exposeToolsAsCommands?: boolean;
}

export interface ExecutorHandle {
  commands: Command[];
  invokeTool: (path: string, argsJson: string) => Promise<string>;
  sdk?: ExecutorSDKHandle;
}

export function parseToolArgs(argsJson: string): unknown {
  if (!argsJson) {
    return undefined;
  }
  return JSON.parse(argsJson);
}

export function camelToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const HELP_SENTINEL = Symbol("help");

function coerceValue(raw: string): unknown {
  if (raw === "") {
    return "";
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function assertJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${label} must be a JSON object`);
}

export function parseToolCliArgs(
  args: string[],
  stdin: string,
): Record<string, unknown> | typeof HELP_SENTINEL {
  let result: Record<string, unknown> = Object.create(null);
  const trimmedStdin = stdin.trim();
  if (trimmedStdin) {
    try {
      const parsed = JSON.parse(trimmedStdin);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(result, parsed);
      }
    } catch {
      // Non-JSON stdin is ignored, matching the upstream executor.
    }
  }

  let jsonFlagValue: string | undefined;
  const remainingArgs: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help") {
      return HELP_SENTINEL;
    }
    if (arg === "--json" && i + 1 < args.length) {
      jsonFlagValue = args[++i];
    } else if (arg.startsWith("--json=")) {
      jsonFlagValue = arg.slice(7);
    } else {
      remainingArgs.push(arg);
    }
  }

  if (jsonFlagValue !== undefined) {
    try {
      const parsed = JSON.parse(jsonFlagValue);
      result = Object.assign(Object.create(null), result, assertJsonObject(parsed, "--json"));
    } catch (error) {
      throw new Error(`Invalid --json value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (let i = 0; i < remainingArgs.length; i += 1) {
    const arg = remainingArgs[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      const eqIdx = arg.indexOf("=");
      const key = arg.slice(2, eqIdx);
      if (key) {
        result[key] = coerceValue(arg.slice(eqIdx + 1));
      }
      continue;
    }
    if (arg.startsWith("--") && arg.length > 2) {
      const key = arg.slice(2);
      if (i + 1 < remainingArgs.length && !remainingArgs[i + 1].startsWith("--")) {
        result[key] = coerceValue(remainingArgs[++i]);
      } else {
        result[key] = true;
      }
      continue;
    }
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      result[arg.slice(0, eqIdx)] = coerceValue(arg.slice(eqIdx + 1));
      continue;
    }
    if (remainingArgs.length === 1 && arg.startsWith("{")) {
      try {
        Object.assign(result, assertJsonObject(JSON.parse(arg), "positional JSON"));
      } catch (error) {
        throw new Error(
          `Invalid positional JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return result;
}

interface ToolEntry {
  path: string;
  description?: string;
}

interface ToolSubcommand {
  name: string;
  originalPath: string;
  description?: string;
  aliases?: string[];
}

function formatNamespaceHelp(namespace: string, subcommands: ToolSubcommand[]): string {
  const lines: string[] = [];
  lines.push(`Executor tools: ${namespace}`);
  lines.push("");
  lines.push("USAGE");
  lines.push(`  ${namespace} <command> [flags]`);
  lines.push("");
  lines.push("COMMANDS");
  const maxLen = Math.max(...subcommands.map((sub) => sub.name.length), 0);
  for (const sub of subcommands) {
    const pad = " ".repeat(Math.max(2, maxLen - sub.name.length + 4));
    lines.push(`  ${sub.name}${pad}${sub.description ?? ""}`);
  }
  lines.push("");
  lines.push("EXAMPLES");
  if (subcommands.length > 0) {
    lines.push(`  ${namespace} ${subcommands[0].name} key=value`);
  }
  if (subcommands.length > 1) {
    lines.push(`  ${namespace} ${subcommands[1].name} --key value`);
  }
  lines.push("");
  lines.push("LEARN MORE");
  lines.push(`  ${namespace} <command> --help`);
  lines.push("");
  return lines.join("\n");
}

function formatSubcommandHelp(namespace: string, sub: ToolSubcommand): string {
  const full = `${namespace} ${sub.name}`;
  const lines: string[] = [];
  if (sub.description) {
    lines.push(sub.description);
    lines.push("");
  }
  lines.push("USAGE");
  lines.push(`  ${full} [key=value ...]`);
  lines.push(`  ${full} [--key value ...]`);
  lines.push(`  ${full} --json '{...}'`);
  lines.push(`  <stdin> | ${full}`);
  lines.push("");
  lines.push("FLAGS");
  lines.push("  --json string    Pass all arguments as a JSON object");
  lines.push("  --help           Show this help");
  lines.push("");
  return lines.join("\n");
}

function createNamespaceCommand(
  namespace: string,
  subcommands: ToolSubcommand[],
  invokeTool: (path: string, argsJson: string) => Promise<string>,
): Command {
  const lookup = new Map<string, ToolSubcommand>();
  for (const sub of subcommands) {
    lookup.set(sub.name, sub);
    for (const alias of sub.aliases ?? []) {
      if (!lookup.has(alias)) {
        lookup.set(alias, sub);
      }
    }
  }

  return {
    name: namespace,
    async execute(args, ctx) {
      if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
        return { stdout: formatNamespaceHelp(namespace, subcommands), stderr: "", exitCode: 0 };
      }

      const subName = args[0];
      const sub = lookup.get(subName);
      if (!sub) {
        return {
          stdout: "",
          stderr: `${namespace}: unknown command "${subName}"\nRun '${namespace} --help' for usage.\n`,
          exitCode: 1,
        };
      }

      try {
        const parsed = parseToolCliArgs(args.slice(1), decodeBytesToUtf8(ctx.stdin));
        if (parsed === HELP_SENTINEL) {
          return { stdout: formatSubcommandHelp(namespace, sub), stderr: "", exitCode: 0 };
        }
        const argsJson = Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : "";
        const resultJson = await invokeTool(sub.originalPath, argsJson);
        return { stdout: resultJson ? `${resultJson}\n` : "", stderr: "", exitCode: 0 };
      } catch (error) {
        throw new Error(`${sub.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export function buildNamespaceCommands(
  tools: ToolEntry[],
  invokeTool: (path: string, argsJson: string) => Promise<string>,
): Command[] {
  const groups = new Map<string, ToolSubcommand[]>();
  for (const tool of tools) {
    const dotIdx = tool.path.indexOf(".");
    if (dotIdx === -1) {
      continue;
    }
    const namespace = tool.path.slice(0, dotIdx);
    const rawName = tool.path.slice(dotIdx + 1);
    const kebabName = camelToKebab(rawName);
    const sub: ToolSubcommand = {
      name: kebabName,
      originalPath: tool.path,
      description: tool.description,
    };
    if (kebabName !== rawName) {
      sub.aliases = [rawName];
    }
    const group = groups.get(namespace) ?? [];
    group.push(sub);
    groups.set(namespace, group);
  }
  return [...groups].map(([namespace, subcommands]) =>
    createNamespaceCommand(namespace, subcommands, invokeTool),
  );
}

export async function createExecutor(config: ExecutorConfig = {}): Promise<ExecutorHandle> {
  const inlineTools = Object.assign(Object.create(null), config.tools ?? {}) as Record<
    string,
    ExecutorToolDef
  >;
  const entries = Object.keys(inlineTools).map((path) => ({
    path,
    description: inlineTools[path].description,
  }));
  const invokeTool = async (path: string, argsJson: string): Promise<string> => {
    const tool = inlineTools[path];
    if (!tool) {
      throw new Error(`Unknown tool: ${path}`);
    }
    const result = await tool.execute(parseToolArgs(argsJson));
    return result === undefined ? "" : JSON.stringify(result);
  };

  if (config.setup) {
    throw new Error("moon-bash executor SDK discovery is not implemented yet");
  }

  return {
    commands: config.exposeToolsAsCommands === false ? [] : buildNamespaceCommands(entries, invokeTool),
    invokeTool,
  };
}
