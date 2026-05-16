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
