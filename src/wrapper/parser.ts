export interface ScriptNode {
  type: "Script";
  statements: StatementNode[];
  sourceText?: string;
}

export interface StatementNode {
  type: "Statement";
  pipelines: PipelineNode[];
  operators: ("&&" | "||" | ";")[];
  background: boolean;
  sourceText?: string;
}

export interface PipelineNode {
  type: "Pipeline";
  commands: CommandNode[];
  negated: boolean;
  timed?: boolean;
  timePosix?: boolean;
  pipeStderr?: boolean[];
}

export type CommandNode =
  | SimpleCommandNode
  | IfNode
  | ForNode
  | WhileNode
  | UntilNode
  | GroupNode
  | FunctionDefNode;

export interface IfNode {
  type: "If";
  clauses: IfClause[];
  elseBody: StatementNode[] | null;
  redirections: RedirectionNode[];
}

export interface IfClause {
  condition: StatementNode[];
  body: StatementNode[];
}

export interface ForNode {
  type: "For";
  variable: string;
  words: WordNode[] | null;
  body: StatementNode[];
  redirections: RedirectionNode[];
}

export interface WhileNode {
  type: "While";
  condition: StatementNode[];
  body: StatementNode[];
  redirections: RedirectionNode[];
}

export interface UntilNode {
  type: "Until";
  condition: StatementNode[];
  body: StatementNode[];
  redirections: RedirectionNode[];
}

export interface GroupNode {
  type: "Group";
  body: StatementNode[];
  redirections: RedirectionNode[];
}

export interface FunctionDefNode {
  type: "FunctionDef";
  name: string;
  body: GroupNode;
  redirections: RedirectionNode[];
}

export interface SimpleCommandNode {
  type: "SimpleCommand";
  assignments: AssignmentNode[];
  name: WordNode | null;
  args: WordNode[];
  redirections: RedirectionNode[];
  line?: number;
}

export interface AssignmentNode {
  type: "Assignment";
  name: string;
  value: WordNode;
  append: boolean;
  array: null;
}

export interface RedirectionNode {
  type: "Redirection";
  fd: number | null;
  operator: string;
  target: WordNode;
}

export interface WordNode {
  type: "Word";
  parts: WordPart[];
}

export type WordPart =
  | { type: "Literal"; value: string }
  | { type: "DoubleQuoted"; parts: WordPart[] }
  | { type: "SingleQuoted"; value: string }
  | { type: "ParameterExpansion"; parameter: string; operation: ParameterOperation | null }
  | { type: "CommandSubstitution"; body: ScriptNode; legacy: boolean };

export type ParameterOperation =
  | { type: "DefaultValue"; word: WordNode; checkEmpty: boolean }
  | { type: "AssignDefault"; word: WordNode; checkEmpty: boolean }
  | { type: "ErrorIfUnset"; word: WordNode | null; checkEmpty: boolean }
  | { type: "UseAlternative"; word: WordNode; checkEmpty: boolean };

function splitTopLevel(script: string, separators: string[]): { parts: string[]; operators: string[] } {
  const parts: string[] = [];
  const operators: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  for (let i = 0; i < script.length; i += 1) {
    const char = script[i];
    if (char === "\\" && i + 1 < script.length) {
      current += char + script[i + 1];
      i += 1;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    const op = separators.find((candidate) => script.startsWith(candidate, i));
    if (op) {
      parts.push(current.trim());
      operators.push(op);
      current = "";
      i += op.length - 1;
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return { parts: parts.filter((part) => part.length > 0), operators };
}

function splitWords(input: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  const groupClosers: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "\\" && i + 1 < input.length) {
      current += char + input[i + 1];
      i += 1;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (input.startsWith("$(", i) || input.startsWith("${", i)) {
      current += input.slice(i, i + 2);
      groupClosers.push(input[i + 1] === "(" ? ")" : "}");
      i += 1;
      continue;
    }
    if (groupClosers.length > 0) {
      current += char;
      if (char === groupClosers[groupClosers.length - 1]) {
        groupClosers.pop();
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        out.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) out.push(current);
  return out;
}

function parseWordToken(token: string): WordNode {
  if (token.startsWith("\"") && token.endsWith("\"")) {
    return { type: "Word", parts: [{ type: "DoubleQuoted", parts: parseWordParts(token.slice(1, -1)) }] };
  }
  if (token.startsWith("'") && token.endsWith("'")) {
    return { type: "Word", parts: [{ type: "SingleQuoted", value: token.slice(1, -1) }] };
  }
  return { type: "Word", parts: parseWordParts(token) };
}

function parseWordParts(value: string): WordPart[] {
  const parts: WordPart[] = [];
  let literal = "";
  const flushLiteral = (): void => {
    if (literal) {
      parts.push({ type: "Literal", value: literal });
      literal = "";
    }
  };

  for (let i = 0; i < value.length;) {
    if (value.startsWith("$(", i)) {
      const end = findBalancedEnd(value, i + 2, "(", ")");
      if (end !== -1) {
        flushLiteral();
        parts.push({
          type: "CommandSubstitution",
          body: parse(value.slice(i + 2, end).trim()),
          legacy: false,
        });
        i = end + 1;
        continue;
      }
    }

    if (value.startsWith("${", i)) {
      const end = findBalancedEnd(value, i + 2, "{", "}");
      if (end !== -1) {
        flushLiteral();
        parts.push(parseParameterExpansion(value.slice(i + 2, end)));
        i = end + 1;
        continue;
      }
    }

    if (value[i] === "$") {
      const match = /^[A-Za-z_][A-Za-z0-9_]*|^[?#@*$!\-0-9]/.exec(value.slice(i + 1));
      if (match) {
        flushLiteral();
        parts.push({
          type: "ParameterExpansion",
          parameter: match[0],
          operation: null,
        });
        i += match[0].length + 1;
        continue;
      }
    }

    literal += value[i];
    i += 1;
  }
  flushLiteral();
  return parts.length > 0 ? parts : [{ type: "Literal", value }];
}

function findBalancedEnd(value: string, start: number, open: string, close: string): number {
  let depth = 1;
  let quote: "'" | "\"" | null = null;
  for (let i = start; i < value.length; i += 1) {
    const char = value[i];
    if (char === "\\" && i + 1 < value.length) {
      i += 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (char === open) {
      depth += 1;
      continue;
    }
    if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseParameterExpansion(content: string): WordPart {
  const opMatch = /^([A-Za-z_][A-Za-z0-9_]*)(:-|-|:=|=|:\?|\?|\+|:\+)([\s\S]*)$/.exec(content);
  if (!opMatch) {
    return { type: "ParameterExpansion", parameter: content, operation: null };
  }
  const [, parameter, operator, operand] = opMatch;
  const checkEmpty = operator.startsWith(":");
  const word = operand.length > 0 ? parseWordToken(operand) : null;
  switch (operator.replace(":", "")) {
    case "-":
      return {
        type: "ParameterExpansion",
        parameter,
        operation: { type: "DefaultValue", word: word ?? { type: "Word", parts: [] }, checkEmpty },
      };
    case "=":
      return {
        type: "ParameterExpansion",
        parameter,
        operation: { type: "AssignDefault", word: word ?? { type: "Word", parts: [] }, checkEmpty },
      };
    case "?":
      return {
        type: "ParameterExpansion",
        parameter,
        operation: { type: "ErrorIfUnset", word, checkEmpty },
      };
    case "+":
      return {
        type: "ParameterExpansion",
        parameter,
        operation: { type: "UseAlternative", word: word ?? { type: "Word", parts: [] }, checkEmpty },
      };
    default:
      return { type: "ParameterExpansion", parameter: content, operation: null };
  }
}

function parseSimpleCommand(source: string): SimpleCommandNode {
  const tokens = splitWords(source);
  const assignments: AssignmentNode[] = [];
  const redirections: RedirectionNode[] = [];
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*(\+)?=/.test(token) && words.length === 0) {
      const eq = token.indexOf("=");
      const name = token.slice(0, eq).replace(/\+$/, "");
      assignments.push({
        type: "Assignment",
        name,
        value: parseWordToken(token.slice(eq + 1)),
        append: token.slice(0, eq).endsWith("+"),
        array: null,
      });
      continue;
    }
    if (/^(\d+)?(>>|>|<|2>|>&|2>>)$/.test(token)) {
      const match = token.match(/^(\d+)?(>>|>|<|2>|>&|2>>)$/)!;
      const operator = match[2] === "2>" ? ">" : match[2] === "2>>" ? ">>" : match[2];
      redirections.push({
        type: "Redirection",
        fd: match[1] ? Number.parseInt(match[1], 10) : token.startsWith("2") ? 2 : null,
        operator,
        target: parseWordToken(tokens[i + 1] ?? ""),
      });
      i += 1;
      continue;
    }
    words.push(token);
  }
  const name = words.length > 0 ? parseWordToken(words[0]) : null;
  const args = words.slice(1).map(parseWordToken);
  return { type: "SimpleCommand", name, args, assignments, redirections, line: 1 };
}

function trimTrailingSemicolon(source: string): string {
  return source.trim().replace(/;+$/, "").trim();
}

function statementsFrom(source: string): StatementNode[] {
  const trimmed = trimTrailingSemicolon(source);
  return trimmed.length > 0 ? parse(trimmed).statements : [];
}

function findKeyword(source: string, keyword: string): number {
  const match = new RegExp(`(^|[;\\s])${keyword}([;\\s]|$)`).exec(source);
  if (!match) return -1;
  return match.index + match[1].length;
}

function parseIfCommand(source: string): IfNode | null {
  if (!source.startsWith("if ")) return null;
  const withoutFi = source.replace(/\s*;?\s*fi\s*$/, "");
  if (withoutFi === source) return null;
  const inner = withoutFi.slice(3).trim();
  const thenIndex = findKeyword(inner, "then");
  if (thenIndex === -1) return null;
  const conditionSource = trimTrailingSemicolon(inner.slice(0, thenIndex));
  const afterThen = inner.slice(thenIndex + "then".length).trim();
  const elseIndex = findKeyword(afterThen, "else");
  const bodySource = elseIndex === -1
    ? trimTrailingSemicolon(afterThen)
    : trimTrailingSemicolon(afterThen.slice(0, elseIndex));
  const elseSource = elseIndex === -1
    ? null
    : trimTrailingSemicolon(afterThen.slice(elseIndex + "else".length));
  return {
    type: "If",
    clauses: [{
      condition: statementsFrom(conditionSource),
      body: statementsFrom(bodySource),
    }],
    elseBody: elseSource === null ? null : statementsFrom(elseSource),
    redirections: [],
  };
}

function parseForCommand(source: string): ForNode | null {
  const match = /^for\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+in\s+([\s\S]*?))?\s*;\s*do\s+([\s\S]*?)\s*;?\s*done$/.exec(source);
  if (!match) return null;
  const [, variable, wordsSource, bodySource] = match;
  return {
    type: "For",
    variable,
    words: wordsSource === undefined || wordsSource.trim().length === 0
      ? null
      : splitWords(wordsSource).map(parseWordToken),
    body: statementsFrom(bodySource),
    redirections: [],
  };
}

function parseLoopCommand(source: string, type: "While" | "Until"): WhileNode | UntilNode | null {
  const keyword = type === "While" ? "while" : "until";
  const match = new RegExp(`^${keyword}\\s+([\\s\\S]*?)\\s*;\\s*do\\s+([\\s\\S]*?)\\s*;?\\s*done$`).exec(source);
  if (!match) return null;
  return {
    type,
    condition: statementsFrom(match[1]),
    body: statementsFrom(match[2]),
    redirections: [],
  };
}

function parseFunctionDefCommand(source: string): FunctionDefNode | null {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{\s*([\s\S]*?)\s*;?\s*\}$/.exec(source);
  if (!match) return null;
  return {
    type: "FunctionDef",
    name: match[1],
    body: {
      type: "Group",
      body: statementsFrom(match[2]),
      redirections: [],
    },
    redirections: [],
  };
}

function parseCommand(source: string): CommandNode {
  const trimmed = source.trim();
  return parseIfCommand(trimmed)
    ?? parseForCommand(trimmed)
    ?? parseLoopCommand(trimmed, "While")
    ?? parseLoopCommand(trimmed, "Until")
    ?? parseFunctionDefCommand(trimmed)
    ?? parseSimpleCommand(trimmed);
}

export function parse(script: string): ScriptNode {
  const trimmed = script.trim();
  const compound = parseIfCommand(trimmed)
    ?? parseForCommand(trimmed)
    ?? parseLoopCommand(trimmed, "While")
    ?? parseLoopCommand(trimmed, "Until")
    ?? parseFunctionDefCommand(trimmed);
  if (compound) {
    return {
      type: "Script",
      statements: [{
        type: "Statement",
        pipelines: [{
          type: "Pipeline",
          commands: [compound],
          negated: false,
          timed: false,
          timePosix: false,
        }],
        operators: [],
        background: false,
        sourceText: script,
      }],
    };
  }

  const statementSplit = splitTopLevel(script, ["&&", "||", ";"]);
  const pipelines = statementSplit.parts.map((part) => {
    const pipeSplit = splitTopLevel(part, ["|&", "|"]);
    return {
      type: "Pipeline" as const,
      commands: pipeSplit.parts.map(parseCommand),
      negated: false,
      timed: false,
      timePosix: false,
      ...(pipeSplit.operators.length > 0
        ? { pipeStderr: pipeSplit.operators.map((op) => op === "|&") }
        : {}),
    };
  });
  return {
    type: "Script",
    statements: [{
      type: "Statement",
      pipelines,
      operators: statementSplit.operators as ("&&" | "||" | ";")[],
      background: false,
      sourceText: script,
    }],
    sourceText: script,
  };
}
