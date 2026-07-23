import { afterEach, describe, expect, it } from "vite-plus/test";
import { Writable } from "node:stream";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InMemoryFs,
  Sandbox,
} from "../../../wrapper/index.ts";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "moonbash-sandbox-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("Sandbox compatibility", () => {
  it("runs commands through just-bash compatible overloads", async () => {
    const sandbox = await Sandbox.create({ cwd: "/", env: { BASE: "1" } });

    let command = await sandbox.runCommand("echo", ["hello"]);
    expect(command.exitCode).toBe(0);
    expect(command.cwd).toBe("/");
    expect(command.startedAt).toBeInstanceOf(Date);
    expect(await command.stdout()).toBe("hello\n");
    expect(await command.stderr()).toBe("");
    expect(await command.output()).toBe("hello\n");

    command = await sandbox.runCommand("pwd", { cwd: "/tmp" });
    expect(await command.stdout()).toBe("/tmp\n");

    command = await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", "echo $BASE:$EXTRA; pwd"],
      cwd: "/tmp",
      env: { EXTRA: "2" },
    });
    expect(command.exitCode).toBe(0);
    expect(await command.stdout()).toBe("1:2\n/tmp\n");
  });

  it("supports logs, writable streams, detached wait, and kill", async () => {
    const sandbox = await Sandbox.create({ cwd: "/" });
    let streamed = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        streamed += chunk.toString();
        callback();
      },
    });

    const command = await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", "echo out; echo err >&2"],
      stdout,
    });
    expect(streamed).toBe("out\n");
    expect(await command.output()).toBe("out\nerr\n");

    const logs = [];
    for await (const message of command.logs()) {
      logs.push({
        type: message.type,
        data: message.data,
        timestamp: message.timestamp instanceof Date,
      });
    }
    expect(logs).toEqual([
      { type: "stdout", data: "out\n", timestamp: true },
      { type: "stderr", data: "err\n", timestamp: true },
    ]);

    const detached = await sandbox.runCommand({
      cmd: "echo",
      args: ["detached"],
      detached: true,
    });
    expect(detached.exitCode).toBeUndefined();
    expect(await detached.stdout()).toBe("detached\n");
    expect(detached.exitCode).toBe(0);
    await detached.kill();
  });

  it("writes, reads, and creates files with compatible encodings", async () => {
    const sandbox = await Sandbox.create({ cwd: "/" });

    await sandbox.writeFiles({
      "/plain.txt": "plain",
      "/b64.txt": {
        content: Buffer.from("base64").toString("base64"),
        encoding: "base64",
      },
    });
    await sandbox.mkDir("/new/dir", { recursive: true });

    expect(await sandbox.readFile("/plain.txt")).toBe("plain");
    expect(await sandbox.readFile("/b64.txt")).toBe("base64");
    expect(await sandbox.readFile("/b64.txt", "base64")).toBe(Buffer.from("base64").toString("base64"));
    expect(await (await sandbox.runCommand("test -d /new/dir && echo yes")).stdout()).toBe("yes\n");
  });

  it("accepts custom fs and overlayRoot while rejecting both together", async () => {
    const customFs = new InMemoryFs({ "/a.txt": "A" });
    const withFs = await Sandbox.create({ fs: customFs, cwd: "/" });
    expect(await withFs.readFile("/a.txt")).toBe("A");

    const root = makeRoot();
    writeFileSync(join(root, "real.txt"), "real");
    const overlay = await Sandbox.create({ overlayRoot: root });
    expect(await overlay.readFile("/home/user/project/real.txt")).toBe("real");
    await overlay.writeFiles({ "/home/user/project/new.txt": "overlay" });
    expect(await overlay.readFile("/home/user/project/new.txt")).toBe("overlay");

    await expect(Sandbox.create({ fs: customFs, overlayRoot: root })).rejects.toThrow(/both 'fs' and 'overlayRoot'/);
  });

  it("supports timeout, pre-aborted signal, and lifecycle no-ops", async () => {
    const sandbox = await Sandbox.create({ cwd: "/" });
    const controller = new AbortController();
    controller.abort();

    const command = await sandbox.runCommand({
      cmd: "echo",
      args: ["blocked"],
      signal: controller.signal,
    });
    expect(command.exitCode).toBe(124);
    expect(await command.stdout()).toBe("");

    await sandbox.stop();
    await sandbox.extendTimeout(123);
    expect(sandbox.domain).toBeUndefined();
    expect(typeof sandbox.bashEnvInstance.exec).toBe("function");
  });
});
