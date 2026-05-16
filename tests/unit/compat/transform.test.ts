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

  it("parses and serializes basic compound commands in upstream AST shape", () => {
    const ifAst = parse("if true; then echo yes; else cat no; fi");
    const ifCommand = ifAst.statements[0].pipelines[0].commands[0] as any;

    expect(ifCommand.type).toBe("If");
    expect(ifCommand.clauses[0].condition[0].pipelines[0].commands[0].name.parts[0].value).toBe("true");
    expect(ifCommand.clauses[0].body[0].pipelines[0].commands[0].name.parts[0].value).toBe("echo");
    expect(ifCommand.elseBody[0].pipelines[0].commands[0].name.parts[0].value).toBe("cat");
    expect(ifCommand.redirections).toEqual([]);
    expect(serialize(ifAst)).toBe("if true; then\necho yes\nelse\ncat no\nfi");

    const forAst = parse("for f in a b; do echo $f; done");
    const forCommand = forAst.statements[0].pipelines[0].commands[0] as any;

    expect(forCommand.type).toBe("For");
    expect(forCommand.variable).toBe("f");
    expect(forCommand.words.map((word: any) => word.parts[0].value)).toEqual(["a", "b"]);
    expect(forCommand.body[0].pipelines[0].commands[0].args[0].parts[0]).toEqual({
      type: "ParameterExpansion",
      parameter: "f",
      operation: null,
    });
    expect(serialize(forAst)).toBe("for f in a b; do\necho $f\ndone");

    const functionAst = parse("foo() { echo hi; }");
    const functionCommand = functionAst.statements[0].pipelines[0].commands[0] as any;

    expect(functionCommand.type).toBe("FunctionDef");
    expect(functionCommand.name).toBe("foo");
    expect(functionCommand.body.type).toBe("Group");
    expect(functionCommand.body.body[0].pipelines[0].commands[0].name.parts[0].value).toBe("echo");
    expect(serialize(functionAst)).toBe("foo() { echo hi; }");
  });

  it("collects commands recursively from compound commands and substitutions", () => {
    const ast = parse("if true; then echo $(cat file); else printf ${FOO:-$(date)}; fi");
    const result = new CommandCollectorPlugin().transform({ ast, metadata: {} });

    expect(result.metadata.commands).toEqual(["cat", "date", "echo", "printf", "true"]);
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
