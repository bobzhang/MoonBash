import { describe, expect, it } from "vite-plus/test";
import { Bash } from "../Bash.js";
import { createExecutor, parseToolArgs } from "../../../wrapper/executor.ts";

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

  it("discovers custom setup sources without external executor SDK packages", async () => {
    const executor = await createExecutor({
      setup: async (sdk) => {
        await sdk.sources.add({
          kind: "custom",
          name: "weather",
          tools: {
            forecast: {
              description: "Get a forecast",
              execute: ({ city = "unknown" }: { city?: string }) => ({ city, tempC: 23 }),
            },
          },
        });
      },
    });
    const bash = new Bash({ customCommands: executor.commands });

    await expect(executor.invokeTool("weather.forecast", '{"city":"Paris"}')).resolves.toBe(
      '{"city":"Paris","tempC":23}',
    );
    expect((await bash.exec("weather forecast city=Berlin")).stdout).toBe(
      '{"city":"Berlin","tempC":23}\n',
    );
    await expect(executor.sdk?.tools.list()).resolves.toEqual([
      { id: "weather.forecast", description: "Get a forecast", sourceId: "weather" },
    ]);
    await expect(executor.sdk?.sources.list()).resolves.toEqual([
      { id: "weather", kind: "custom", name: "weather" },
    ]);
  });

  it("applies setup source approval gates to direct and command tool calls", async () => {
    const seen: string[] = [];
    const executor = await createExecutor({
      setup: async (sdk) => {
        await sdk.sources.add({
          kind: "custom",
          name: "ops",
          tools: {
            deleteThing: {
              execute: ({ id }: { id?: string }) => ({ deleted: id }),
            },
          },
        });
      },
      onToolApproval: async (request) => {
        seen.push(`${request.toolPath}:${request.sourceId}:${request.args && typeof request.args}`);
        return { approved: false, reason: "needs review" };
      },
    });
    const bash = new Bash({ customCommands: executor.commands });

    await expect(executor.invokeTool("ops.deleteThing", '{"id":"a"}')).rejects.toThrow(
      "Tool invocation denied: ops.deleteThing (needs review)",
    );
    const result = await bash.exec("ops delete-thing id=b");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Tool invocation denied: ops.deleteThing (needs review)");
    expect(seen).toEqual(["ops.deleteThing:ops:object", "ops.deleteThing:ops:object"]);
  });

  it("routes setup source elicitation through configured handlers", async () => {
    const executor = await createExecutor({
      setup: async (sdk) => {
        await sdk.sources.add({
          kind: "custom",
          name: "profile",
          tools: {
            create: {
              execute: async (_args: unknown, ctx: any) => {
                const response = await ctx.elicit({
                  _tag: "FormElicitation",
                  message: "Profile details",
                  requestedSchema: { type: "object" },
                });
                return { action: response.action, name: response.content?.name ?? null };
              },
            },
          },
        });
      },
      onElicitation: async (ctx) => {
        expect(ctx.toolId).toBe("profile.create");
        expect(ctx.args).toEqual({ seed: true });
        expect(ctx.request).toMatchObject({
          _tag: "FormElicitation",
          message: "Profile details",
        });
        return { action: "accept", content: { name: "Ada" } };
      },
    });

    await expect(executor.invokeTool("profile.create", '{"seed":true}')).resolves.toBe(
      '{"action":"accept","name":"Ada"}',
    );
  });

  it("declines setup source elicitation by default", async () => {
    const executor = await createExecutor({
      setup: async (sdk) => {
        await sdk.sources.add({
          kind: "custom",
          name: "profile",
          tools: {
            create: {
              execute: async (_args: unknown, ctx: any) => {
                return ctx.elicit({
                  _tag: "UrlElicitation",
                  message: "Authorize",
                  url: "https://example.com/oauth",
                  elicitationId: "auth-1",
                });
              },
            },
          },
        });
      },
    });

    await expect(executor.invokeTool("profile.create", "")).resolves.toBe('{"action":"decline"}');
  });

  it("supports accept-all setup source elicitation", async () => {
    const executor = await createExecutor({
      setup: async (sdk) => {
        await sdk.sources.add({
          kind: "custom",
          name: "profile",
          tools: {
            create: {
              execute: async (_args: unknown, ctx: any) => {
                return ctx.elicit({
                  _tag: "FormElicitation",
                  message: "Profile details",
                  requestedSchema: { type: "object" },
                });
              },
            },
          },
        });
      },
      onElicitation: "accept-all",
    });

    await expect(executor.invokeTool("profile.create", "")).resolves.toBe('{"action":"accept"}');
  });
});
