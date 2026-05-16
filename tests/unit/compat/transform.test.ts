import { describe, expect, it } from "vite-plus/test";
import {
  Bash,
  BashTransformPipeline,
  CommandCollectorPlugin,
  parse,
  serialize,
  TeePlugin,
} from "../../../src/wrapper/index.ts";

describe("Transform compatibility", () => {
  it("parses and serializes simple commands in just-bash AST shape", () => {
    const ast = parse('FOO=bar echo "$FOO" > out.txt');

    expect(ast.type).toBe("Script");
    expect(ast.sourceText).toBe('FOO=bar echo "$FOO" > out.txt');
    expect(ast.statements).toHaveLength(1);
    const statement = ast.statements[0] as any;
    expect(statement.type).toBe("Statement");
    expect(statement.operators).toEqual([]);
    expect(statement.background).toBe(false);
    const command = statement.pipelines[0].commands[0];
    expect(command.type).toBe("SimpleCommand");
    expect(command.name.parts[0]).toEqual({ type: "Literal", value: "echo" });
    expect(command.assignments[0].name).toBe("FOO");
    expect(command.args[0].parts[0].type).toBe("DoubleQuoted");
    expect(command.redirections[0].operator).toBe(">");
    expect(serialize(ast)).toBe('FOO=bar echo "$FOO" > out.txt');
  });

  it("collects unique command names across pipelines", () => {
    const ast = parse("echo a && cat file | grep foo && echo b");
    const result = new CommandCollectorPlugin().transform({ ast, metadata: {} });

    expect(result.ast).toBe(ast);
    expect(result.metadata.commands).toEqual(["cat", "echo", "grep"]);
  });

  it("runs pipeline plugins and merges metadata", () => {
    const result = new BashTransformPipeline()
      .use(new CommandCollectorPlugin())
      .use(new TeePlugin({ outputDir: "/tmp/tee" }))
      .transform("echo hi | cat");

    expect(result.metadata.commands).toEqual(["cat", "echo"]);
    expect(result.metadata.teeFiles).toHaveLength(2);
    expect(result.metadata.teeFiles[0]).toMatchObject({
      commandIndex: 0,
      commandName: "echo",
      command: "echo hi",
    });
    expect(result.metadata.teeFiles[0].stdoutFile).toContain("/tmp/tee/");
    expect(result.script).toContain("tee /tmp/tee/");
    expect(result.script).toContain("__tps0=${PIPESTATUS[0]}");
    expect(serialize(result.ast)).toBe(result.script);
  });

  it("wires Bash transform plugins through Bash.transform", () => {
    const bash = new Bash();
    bash.registerTransformPlugin(new CommandCollectorPlugin());

    const result = bash.transform("printf hi");

    expect(result.script).toBe("printf hi");
    expect(result.metadata.commands).toEqual(["printf"]);
  });
});
