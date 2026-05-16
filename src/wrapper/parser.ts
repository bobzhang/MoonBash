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
