import { describe, expect, it } from "vite-plus/test";
import { Bash } from "../Bash.js";

describe("just-bash JavaScript runtime compatibility", () => {
  it("executes inline code when javascript is enabled", async () => {
    const bash = new Bash({ javascript: true });

    const result = await bash.exec("js-exec -c 'console.log(1 + 2)'");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("3\n");
    expect(result.stderr).toBe("");
  });

  it("runs script files from the virtual filesystem", async () => {
    const bash = new Bash({
      javascript: true,
      files: {
        "/script.js": "console.log(process.argv.slice(2).join(','))",
      },
    });

    const result = await bash.exec("js-exec /script.js alpha beta");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("beta\n");
    expect(result.stderr).toBe("");
  });

  it("applies bootstrap code before inline execution", async () => {
    const bash = new Bash({
      javascript: {
        bootstrap: 'globalThis.API_BASE = "https://api.example.com";',
      },
    });

    const result = await bash.exec("js-exec -c 'console.log(API_BASE)'");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("https://api.example.com\n");
    expect(result.stderr).toBe("");
  });

  it("routes tools proxy calls through javascript.invokeTool", async () => {
    const calls: Array<{ path: string; argsJson: string }> = [];
    const bash = new Bash({
      javascript: {
        invokeTool: async (path, argsJson) => {
          calls.push({ path, argsJson });
          const args = JSON.parse(argsJson);
          return JSON.stringify({ sum: args.a + args.b });
        },
      },
    });

    const result = await bash.exec("js-exec -c 'const r = await tools.math.add({a:3,b:4}); console.log(r.sum)'");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("7\n");
    expect(result.stderr).toBe("");
    expect(calls).toEqual([{ path: "math.add", argsJson: '{"a":3,"b":4}' }]);
  });

  it("matches just-bash js-exec no-input failure", async () => {
    const bash = new Bash({ javascript: true });

    const result = await bash.exec("js-exec");

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("js-exec: no input provided (use -c CODE or provide a script file)\n");
  });

  it("matches just-bash js-exec option errors", async () => {
    const bash = new Bash({ javascript: true });

    const missingInlineCode = await bash.exec("js-exec -c");
    const unknownOption = await bash.exec("js-exec --bad-option");

    expect(missingInlineCode.exitCode).toBe(2);
    expect(missingInlineCode.stdout).toBe("");
    expect(missingInlineCode.stderr).toBe("js-exec: option requires an argument -- 'c'\n");
    expect(unknownOption.exitCode).toBe(2);
    expect(unknownOption.stdout).toBe("");
    expect(unknownOption.stderr).toBe("js-exec: unrecognized option '--bad-option'\n");
  });

  it("matches just-bash js-exec version output", async () => {
    const bash = new Bash({ javascript: true });

    const result = await bash.exec("js-exec --version");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("QuickJS (quickjs-emscripten)\n");
    expect(result.stderr).toBe("");
  });

  it("treats -- as the end of js-exec options", async () => {
    const bash = new Bash({
      javascript: true,
      files: {
        "/dash-script.js": "console.log(process.argv.join('|'))",
      },
    });

    const result = await bash.exec("js-exec -- /dash-script.js left right");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("/dash-script.js|left|right\n");
    expect(result.stderr).toBe("");
  });

  it("provides commonjs fs and path shims backed by the virtual filesystem", async () => {
    const bash = new Bash({
      javascript: true,
      files: {
        "/data/input.txt": "alpha",
      },
    });

    const result = await bash.exec(
      "js-exec -c 'const fs = require(\"fs\"); const path = require(\"node:path\"); const p = path.join(\"/data\", \"input.txt\"); console.log(fs.readFileSync(p, \"utf8\")); console.log(Buffer.isBuffer(fs.readFileSync(p))); console.log(fs.statSync(p).isFile()); console.log(fs.existsSync(path.resolve(\"/data\", \"missing.txt\")))'",
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("alpha\ntrue\ntrue\nfalse\n");
    expect(result.stderr).toBe("");
  });

  it("reports node as a js-exec compatibility stub", async () => {
    const bash = new Bash({ javascript: true });

    const result = await bash.exec("node -e 'console.log(2)'");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("node: this sandbox uses js-exec instead of node");
    expect(result.stderr).toContain("Usage: js-exec");
  });
});
