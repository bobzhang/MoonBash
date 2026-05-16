import type { ScriptNode } from "./parser";
import { parse, type AssignmentNode, type CommandNode, type ForNode, type FunctionDefNode, type IfNode, type PipelineNode, type RedirectionNode, type SimpleCommandNode, type StatementNode, type UntilNode, type WhileNode, type WordNode, type WordPart } from "./parser";

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
      if (!part.operation) {
        return shouldBraceParameter(part.parameter) ? `\${${part.parameter}}` : `$${part.parameter}`;
      }
      return `\${${serializeParameterExpansion(part.parameter, part.operation)}}`;
    case "CommandSubstitution":
      return part.legacy ? `\`${serialize(part.body)}\`` : `$(${serialize(part.body)})`;
    case "Literal":
    default:
      return part.value;
  }
}

function shouldBraceParameter(parameter: string): boolean {
  return !(/^[?#@*$!\-0-9]$/.test(parameter) || /^[A-Za-z_][A-Za-z0-9_]*$/.test(parameter));
}

function serializeParameterWord(word: WordNode): string {
  return word.parts.map(serializeWordPart).join("");
}

function serializeParameterExpansion(parameter: string, operation: NonNullable<Extract<WordPart, { type: "ParameterExpansion" }>["operation"]>): string {
  switch (operation.type) {
    case "DefaultValue":
      return `${parameter}${operation.checkEmpty ? ":" : ""}-${serializeParameterWord(operation.word)}`;
    case "AssignDefault":
      return `${parameter}${operation.checkEmpty ? ":" : ""}=${serializeParameterWord(operation.word)}`;
    case "ErrorIfUnset":
      return `${parameter}${operation.checkEmpty ? ":" : ""}?${operation.word ? serializeParameterWord(operation.word) : ""}`;
    case "UseAlternative":
      return `${parameter}${operation.checkEmpty ? ":" : ""}+${serializeParameterWord(operation.word)}`;
    default:
      return parameter;
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
  switch (command.type) {
    case "SimpleCommand": {
      const parts = [
        ...command.assignments.map(serializeAssignment),
        ...(command.name ? [serializeWord(command.name)] : []),
        ...command.args.map(serializeWord),
        ...command.redirections.map(serializeRedirection),
      ];
      return parts.join(" ");
    }
    case "If":
      return serializeIf(command);
    case "For":
      return serializeFor(command);
    case "While":
      return serializeLoop(command, "while");
    case "Until":
      return serializeLoop(command, "until");
    case "Group":
      return `{ ${serializeStatements(command.body)}; }${serializeRedirectionSuffix(command.redirections)}`;
    case "FunctionDef":
      return serializeFunctionDef(command);
    default: {
      const unsupported = command as { type: string };
      throw new Error(`Unsupported command type: ${unsupported.type}`);
    }
  }
}

function serializeStatements(statements: StatementNode[]): string {
  return statements.map((statement) => statement.pipelines
    .map(serializePipeline)
    .reduce((out, pipeline, index) => {
      if (index === 0) return pipeline;
      return `${out} ${statement.operators[index - 1] ?? ";"} ${pipeline}`;
    }, "")).join("\n");
}

function serializeRedirectionSuffix(redirections: RedirectionNode[]): string {
  return redirections.length === 0 ? "" : ` ${redirections.map(serializeRedirection).join(" ")}`;
}

function serializeIf(command: IfNode): string {
  const clauses = command.clauses.map((clause, index) => {
    const keyword = index === 0 ? "if" : "elif";
    return `${keyword} ${serializeStatements(clause.condition)}; then\n${serializeStatements(clause.body)}`;
  });
  if (command.elseBody) {
    clauses.push(`else\n${serializeStatements(command.elseBody)}`);
  }
  return `${clauses.join("\n")}\nfi${serializeRedirectionSuffix(command.redirections)}`;
}

function serializeFor(command: ForNode): string {
  const header = command.words === null
    ? `for ${command.variable}`
    : `for ${command.variable} in ${command.words.map(serializeWord).join(" ")}`;
  return `${header}; do\n${serializeStatements(command.body)}\ndone${serializeRedirectionSuffix(command.redirections)}`;
}

function serializeLoop(command: WhileNode | UntilNode, keyword: "while" | "until"): string {
  return `${keyword} ${serializeStatements(command.condition)}; do\n${serializeStatements(command.body)}\ndone${serializeRedirectionSuffix(command.redirections)}`;
}

function serializeFunctionDef(command: FunctionDefNode): string {
  return `${command.name}() ${serializeCommand(command.body)}${serializeRedirectionSuffix(command.redirections)}`;
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
  return serializeStatements(node.statements);
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
  if (command.type !== "SimpleCommand" || !command.name) return null;
  const first = command.name.parts[0];
  return first?.type === "Literal" ? first.value : null;
}

function collectCommandNames(ast: ScriptNode): string[] {
  const names = new Set<string>();
  walkScript(ast, names);
  return [...names].sort();
}

function walkScript(ast: ScriptNode, names: Set<string>): void {
  for (const statement of ast.statements) {
    walkStatement(statement, names);
  }
}

function walkStatement(statement: StatementNode, names: Set<string>): void {
  for (const pipeline of statement.pipelines) {
    for (const command of pipeline.commands) {
      walkCommand(command, names);
    }
  }
}

function walkCommand(command: CommandNode, names: Set<string>): void {
  switch (command.type) {
    case "SimpleCommand": {
      const name = commandName(command);
      if (name) names.add(name);
      if (command.name) walkWord(command.name, names);
      for (const arg of command.args) walkWord(arg, names);
      for (const assignment of command.assignments) walkWord(assignment.value, names);
      break;
    }
    case "If":
      for (const clause of command.clauses) {
        for (const statement of clause.condition) walkStatement(statement, names);
        for (const statement of clause.body) walkStatement(statement, names);
      }
      for (const statement of command.elseBody ?? []) walkStatement(statement, names);
      break;
    case "For":
      for (const word of command.words ?? []) walkWord(word, names);
      for (const statement of command.body) walkStatement(statement, names);
      break;
    case "While":
    case "Until":
      for (const statement of command.condition) walkStatement(statement, names);
      for (const statement of command.body) walkStatement(statement, names);
      break;
    case "Group":
      for (const statement of command.body) walkStatement(statement, names);
      break;
    case "FunctionDef":
      walkCommand(command.body, names);
      break;
  }
}

function walkWord(word: WordNode, names: Set<string>): void {
  for (const part of word.parts) {
    if (part.type === "CommandSubstitution") {
      walkScript(part.body, names);
    } else if (part.type === "DoubleQuoted") {
      walkWord({ type: "Word", parts: part.parts }, names);
    } else if (part.type === "ParameterExpansion" && part.operation) {
      walkParameterOperation(part.operation, names);
    }
  }
}

function walkParameterOperation(
  operation: NonNullable<Extract<WordPart, { type: "ParameterExpansion" }>["operation"]>,
  names: Set<string>,
): void {
  switch (operation.type) {
    case "DefaultValue":
    case "AssignDefault":
    case "UseAlternative":
      walkWord(operation.word, names);
      break;
    case "ErrorIfUnset":
      if (operation.word) walkWord(operation.word, names);
      break;
  }
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
