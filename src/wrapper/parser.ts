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

export type CommandNode = SimpleCommandNode;

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
  | { type: "ParameterExpansion"; parameter: string; operation: null };

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
  let rest = value;
  const parameter = /\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\})/;
  while (rest.length > 0) {
    const match = parameter.exec(rest);
    if (!match) {
      if (rest) parts.push({ type: "Literal", value: rest });
      break;
    }
    if (match.index > 0) {
      parts.push({ type: "Literal", value: rest.slice(0, match.index) });
    }
    const raw = match[1];
    parts.push({
      type: "ParameterExpansion",
      parameter: raw.startsWith("{") ? raw.slice(1, -1) : raw,
      operation: null,
    });
    rest = rest.slice(match.index + match[0].length);
  }
  return parts.length > 0 ? parts : [{ type: "Literal", value }];
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

export function parse(script: string): ScriptNode {
  const statementSplit = splitTopLevel(script, ["&&", "||", ";"]);
  const pipelines = statementSplit.parts.map((part) => {
    const pipeSplit = splitTopLevel(part, ["|&", "|"]);
    return {
      type: "Pipeline" as const,
      commands: pipeSplit.parts.map(parseSimpleCommand),
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
