import type { ScriptNode } from "./parser";
import { parse, type AssignmentNode, type CommandNode, type PipelineNode, type RedirectionNode, type SimpleCommandNode, type WordNode, type WordPart } from "./parser";

export interface TransformContext {
  ast: ScriptNode;
  metadata: Record<string, unknown>;
}

export interface TransformResult<TMetadata extends object = object> {
  ast: ScriptNode;
  metadata?: TMetadata;
}

export interface TransformPlugin<TMetadata extends object = object> {
  name: string;
  transform(context: TransformContext): TransformResult<TMetadata>;
}

export interface BashTransformResult<TMetadata extends object = Record<string, unknown>> {
  script: string;
  ast: ScriptNode;
  metadata: TMetadata;
}

function serializeWordPart(part: WordPart): string {
  switch (part.type) {
    case "DoubleQuoted":
      return `"${part.parts.map(serializeWordPart).join("")}"`;
    case "SingleQuoted":
      return `'${part.value}'`;
    case "ParameterExpansion":
      return `$${part.parameter}`;
    case "Literal":
    default:
      return part.value;
  }
}

function serializeWord(word: WordNode): string {
  return word.parts.map(serializeWordPart).join("");
}

function serializeAssignment(assignment: AssignmentNode): string {
  return `${assignment.name}${assignment.append ? "+" : ""}=${serializeWord(assignment.value)}`;
}

function serializeRedirection(redirection: RedirectionNode): string {
  const fd = redirection.fd === null ? "" : String(redirection.fd);
  return `${fd}${redirection.operator} ${serializeWord(redirection.target)}`;
}

function serializeCommand(command: CommandNode): string {
  const simple = command as SimpleCommandNode;
  const parts = [
    ...simple.assignments.map(serializeAssignment),
    ...(simple.name ? [serializeWord(simple.name)] : []),
    ...simple.args.map(serializeWord),
    ...simple.redirections.map(serializeRedirection),
  ];
  return parts.join(" ");
}

function serializePipeline(pipeline: PipelineNode): string {
  return pipeline.commands
    .map(serializeCommand)
    .reduce((out, command, index) => {
      if (index === 0) return command;
      return `${out} ${pipeline.pipeStderr?.[index - 1] ? "|&" : "|"} ${command}`;
    }, "");
}

export function serialize(node: ScriptNode): string {
  if (node.sourceText && node.statements.length === 1) {
    return node.sourceText;
  }
  return node.statements.map((statement) => statement.pipelines
    .map(serializePipeline)
    .reduce((out, pipeline, index) => {
      if (index === 0) return pipeline;
      return `${out} ${statement.operators[index - 1] ?? ";"} ${pipeline}`;
    }, "")).join("; ");
}

export class BashTransformPipeline<TMetadata extends object = Record<string, never>> {
  private readonly plugins: TransformPlugin<object>[];

  constructor(plugins: TransformPlugin<object>[] = []) {
    this.plugins = plugins;
  }

  use<M extends object>(plugin: TransformPlugin<M>): BashTransformPipeline<TMetadata & M> {
    return new BashTransformPipeline<TMetadata & M>([...this.plugins, plugin as TransformPlugin<object>]);
  }

  transform(script: string): BashTransformResult<TMetadata> {
    let ast = parse(script);
    let metadata: Record<string, unknown> = {};
    for (const plugin of this.plugins) {
      const result = plugin.transform({ ast, metadata });
      ast = result.ast;
      metadata = { ...metadata, ...(result.metadata ?? {}) };
    }
    return { script: serialize(ast), ast, metadata: metadata as TMetadata };
  }
}

export interface CommandCollectorMetadata {
  commands: string[];
}

export class CommandCollectorPlugin implements TransformPlugin<CommandCollectorMetadata> {
  name = "command-collector";

  transform(context: TransformContext): TransformResult<CommandCollectorMetadata> {
    return { ast: context.ast, metadata: { commands: collectCommandNames(context.ast) } };
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
    const teeFiles: (TeeFileInfo & { commandIndex: number; commandName: string; command: string; stdoutFile: string })[] = [];
    let commandIndex = 0;
    for (const statement of context.ast.statements) {
      for (const pipeline of statement.pipelines) {
        const nextCommands: CommandNode[] = [];
        const nextPipeStderr: boolean[] = [];
        for (const command of pipeline.commands) {
          nextCommands.push(command);
          const name = commandName(command);
          if (name) {
            const stdoutFile = `${this.options.outputDir}/${new Date().toISOString().replace(/:/g, "-")}-${String(commandIndex).padStart(3, "0")}-${name}.stdout.txt`;
            teeFiles.push({
              path: stdoutFile,
              fd: 1,
              commandIndex,
              commandName: name,
              command: serializeCommand(command),
              stdoutFile,
            });
            nextCommands.push(parseSimpleTee(stdoutFile));
            nextPipeStderr.push(false);
            commandIndex += 1;
          }
          if (nextCommands.length < pipeline.commands.length * 2) {
            nextPipeStderr.push(false);
          }
        }
        pipeline.commands = nextCommands;
        pipeline.pipeStderr = nextCommands.length > 1 ? nextPipeStderr.slice(0, nextCommands.length - 1) : undefined;
      }
      context.ast.sourceText = undefined;
      statement.sourceText = undefined;
    }
    const script = serialize(context.ast);
    context.ast.sourceText = `${script} ; __tps0=\${PIPESTATUS[0]}${teeFiles[1] ? " __tps1=${PIPESTATUS[2]}" : ""} ; ${teeFiles.map((_, index) => `(exit $__tps${index})`).join(" | ")}`;
    return { ast: context.ast, metadata: { teeFiles } };
  }
}

function commandName(command: CommandNode): string | null {
  const simple = command as SimpleCommandNode;
  if (!simple.name) return null;
  const first = simple.name.parts[0];
  return first?.type === "Literal" ? first.value : null;
}

function collectCommandNames(ast: ScriptNode): string[] {
  const names = new Set<string>();
  for (const statement of ast.statements) {
    for (const pipeline of statement.pipelines) {
      for (const command of pipeline.commands) {
        const name = commandName(command);
        if (name) names.add(name);
      }
    }
  }
  return [...names].sort();
}

function literalWord(value: string): WordNode {
  return { type: "Word", parts: [{ type: "Literal", value }] };
}

function parseSimpleTee(path: string): SimpleCommandNode {
  return {
    type: "SimpleCommand",
    assignments: [],
    name: literalWord("tee"),
    args: [literalWord(path)],
    redirections: [],
  };
}
