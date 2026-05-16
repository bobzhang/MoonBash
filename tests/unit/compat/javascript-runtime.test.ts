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

  it("reports node as a js-exec compatibility stub", async () => {
    const bash = new Bash({ javascript: true });

    const result = await bash.exec("node -e 'console.log(2)'");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("node: this sandbox uses js-exec instead of node");
    expect(result.stderr).toContain("Usage: js-exec");
  });
});
