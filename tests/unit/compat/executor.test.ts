import { describe, expect, it } from "vite-plus/test";
import { Bash } from "../Bash.js";
import { createExecutor, parseToolArgs } from "../../../src/wrapper/executor.ts";

describe("just-bash executor companion compatibility", () => {
  it("parses tool args JSON like @just-bash/executor", () => {
    expect(parseToolArgs("")).toBeUndefined();
    expect(parseToolArgs('{"a":1}')).toEqual({ a: 1 });
    expect(() => parseToolArgs("{")).toThrow();
  });

  it("creates namespace commands for inline tools", async () => {
    const executor = await createExecutor({
      tools: {
        "math.add": {
          description: "Add two numbers",
          execute: ({ a = 0, b = 0 }: { a?: number; b?: number }) => ({ sum: a + b }),
        },
        "petstore.listPets": {
          description: "List pets",
          execute: ({ status = "all" }: { status?: string }) => ({ status }),
        },
      },
    });
    const bash = new Bash({ customCommands: executor.commands });

    expect((await bash.exec("math add a=1 b=2")).stdout).toBe('{"sum":3}\n');
    expect((await bash.exec("math add --json '{\"a\":3,\"b\":4}'")).stdout).toBe('{"sum":7}\n');
    expect((await bash.exec("printf '{\"a\":5,\"b\":6}' | math add")).stdout).toBe('{"sum":11}\n');

    const help = await bash.exec("math --help");
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Executor tools: math");
    expect(help.stdout).toContain("add    Add two numbers");

    expect((await bash.exec("petstore list-pets status=available")).stdout).toBe('{"status":"available"}\n');
    expect((await bash.exec("petstore listPets status=raw")).stdout).toBe('{"status":"raw"}\n');
  });

  it("can expose only invokeTool without bash commands", async () => {
    const executor = await createExecutor({
      exposeToolsAsCommands: false,
      tools: {
        "math.add": {
          execute: ({ a = 0, b = 0 }: { a?: number; b?: number }) => ({ sum: a + b }),
        },
      },
    });

    expect(executor.commands).toEqual([]);
    await expect(executor.invokeTool("math.add", '{"a":8,"b":9}')).resolves.toBe('{"sum":17}');
  });
});
