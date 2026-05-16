import { describe, expect, it } from "vite-plus/test";
import { Bash, latin1FromBytes, unsafeBytesFromLatin1 } from "../../src/wrapper/index.ts";

describe("just-bash 3 ExecOptions compatibility", () => {
  it("replaceEnv starts with an empty environment plus provided env", async () => {
    const bash = new Bash({ env: { KEEP: "base" } });
    const result = await bash.exec("printenv KEEP; printenv ONLY", {
      replaceEnv: true,
      env: { ONLY: "exec" },
    });
    expect(result.stdout).not.toContain("base");
    expect(result.stdout).toContain("exec");
  });

  it("args are appended to the first command without shell expansion", async () => {
    const bash = new Bash();
    const result = await bash.exec("printf '%s\\n'", {
      args: ["a b", "*.ts", "$HOME", "semi;colon"],
    });
    expect(result.stdout).toBe("a b\n*.ts\n$HOME\nsemi;colon\n");
  });

  it("stdinKind bytes forwards latin1 byte buffers without UTF-8 re-encoding", async () => {
    const bash = new Bash();
    const raw = latin1FromBytes(unsafeBytesFromLatin1("\x00\xffA"));
    const result = await bash.exec("wc -c", { stdin: raw, stdinKind: "bytes" });
    expect(result.stdout.trim()).toBe("3");
  });

  it("stdinKind text encodes Unicode as UTF-8 bytes", async () => {
    const bash = new Bash();
    const result = await bash.exec("wc -c", { stdin: "你好" });
    expect(result.stdout.trim()).toBe("6");
  });

  it("aborted signal returns timeout-style cancellation result before execution", async () => {
    const bash = new Bash();
    const controller = new AbortController();
    controller.abort();
    const result = await bash.exec("echo should-not-run", { signal: controller.signal });
    expect(result.exitCode).toBe(124);
    expect(result.stdout).toBe("");
  });

  it("supports upstream deprecated top-level execution limit aliases", async () => {
    const bash = new Bash({ maxCommandCount: 1 });

    const result = await bash.exec("echo one; echo two");

    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("too many commands executed");
    expect(result.stdout).toBe("");
  });
});
