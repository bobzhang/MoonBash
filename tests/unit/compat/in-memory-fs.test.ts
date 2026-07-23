import { describe, expect, it } from "vite-plus/test";
import {
  Bash,
  decodeBytesToUtf8,
  InMemoryFs,
  latin1FromBytes,
} from "../../../wrapper/index.ts";

describe("InMemoryFs compatibility", () => {
  it("reads, writes, appends, and stats files asynchronously", async () => {
    const fs = new InMemoryFs({
      "/docs/readme.txt": { content: "hello", mode: 0o600 },
    });

    expect(await fs.readFile("/docs/readme.txt")).toBe("hello");
    expect(await fs.readFileBuffer("/docs/readme.txt")).toEqual(new TextEncoder().encode("hello"));
    expect(decodeBytesToUtf8(await fs.readFileBytes("/docs/readme.txt"))).toBe("hello");

    await fs.appendFile("/docs/readme.txt", " world");
    expect(await fs.readFile("/docs/readme.txt")).toBe("hello world");

    const stat = await fs.stat("/docs/readme.txt");
    expect(stat.isFile).toBe(true);
    expect(stat.isDirectory).toBe(false);
    expect(stat.isSymbolicLink).toBe(false);
    expect(stat.mode).toBe(0o600);
    expect(stat.size).toBe(11);
    expect(stat.mtime).toBeInstanceOf(Date);
  });

  it("supports lazy files and sync initialization helpers", async () => {
    let calls = 0;
    const fs = new InMemoryFs();

    fs.mkdirSync("/cache", { recursive: true });
    fs.writeFileLazy("/cache/value.txt", async () => {
      calls += 1;
      return "computed";
    });

    expect(await fs.readFile("/cache/value.txt")).toBe("computed");
    expect(await fs.readFile("/cache/value.txt")).toBe("computed");
    expect(calls).toBe(1);

    fs.writeFileSync("/cache/value.txt", "updated");
    expect(await fs.readFile("/cache/value.txt")).toBe("updated");
  });

  it("handles directories, dirents, remove, copy, move, and path resolution", async () => {
    const fs = new InMemoryFs();
    await fs.mkdir("/work/src", { recursive: true });
    await fs.writeFile("/work/src/a.txt", "A");
    await fs.writeFile("/work/src/b.txt", "B");

    expect(await fs.readdir("/work/src")).toEqual(["a.txt", "b.txt"]);
    expect(await fs.readdirWithFileTypes("/work")).toEqual([
      {
        name: "src",
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
      },
    ]);

    await fs.cp("/work/src", "/work/copy", { recursive: true });
    expect(await fs.readFile("/work/copy/a.txt")).toBe("A");

    await fs.mv("/work/copy/a.txt", "/work/copy/renamed.txt");
    expect(await fs.exists("/work/copy/a.txt")).toBe(false);
    expect(await fs.readFile("/work/copy/renamed.txt")).toBe("A");

    await fs.rm("/work/src", { recursive: true });
    expect(await fs.exists("/work/src/a.txt")).toBe(false);
    expect(fs.resolvePath("/work/copy", "../src/./x.txt")).toBe("/work/src/x.txt");
  });

  it("supports symlinks, lstat, realpath, chmod, hard links, and utimes", async () => {
    const fs = new InMemoryFs({ "/target.txt": "payload" });
    await fs.symlink("/target.txt", "/link.txt");

    const lstat = await fs.lstat("/link.txt");
    expect(lstat.isSymbolicLink).toBe(true);
    expect(await fs.readlink("/link.txt")).toBe("/target.txt");
    expect(await fs.readFile("/link.txt")).toBe("payload");
    expect(await fs.realpath("/link.txt")).toBe("/target.txt");

    await fs.chmod("/target.txt", 0o755);
    expect((await fs.stat("/target.txt")).mode).toBe(0o755);

    await fs.link("/target.txt", "/hard.txt");
    expect(await fs.readFile("/hard.txt")).toBe("payload");

    const mtime = new Date("2026-05-16T00:00:00.000Z");
    await fs.utimes("/hard.txt", new Date(0), mtime);
    expect((await fs.stat("/hard.txt")).mtime.toISOString()).toBe(mtime.toISOString());
  });

  it("preserves raw byte content through binary reads", async () => {
    const fs = new InMemoryFs();
    const bytes = new Uint8Array([0, 0xff, 0x41]);

    await fs.writeFile("/blob.bin", bytes);

    expect(await fs.readFileBuffer("/blob.bin")).toEqual(bytes);
    expect(latin1FromBytes(await fs.readFileBytes("/blob.bin"))).toBe("\x00\xffA");
    expect(await fs.readFile("/blob.bin", "binary")).toBe("\x00\xffA");
  });

  it("can be passed to Bash options as the execution filesystem", async () => {
    const fs = new InMemoryFs({ "/input.txt": "from fs\n" });
    const bash = new Bash({ fs, cwd: "/" });

    expect((await bash.exec("cat /input.txt")).stdout).toBe("from fs\n");

    await bash.exec("echo changed > /input.txt");
    expect(await fs.readFile("/input.txt")).toBe("changed\n");
    expect(await bash.readFile("/input.txt")).toBe("changed\n");
  });

  it("exposes Bash.fs as the async just-bash filesystem interface", async () => {
    const bash = new Bash({ files: { "/input.txt": "hello" }, cwd: "/" });

    expect(bash.fs.readFile("/input.txt")).toBeInstanceOf(Promise);
    expect(await bash.fs.readFile("/input.txt")).toBe("hello");

    await bash.fs.mkdir("/dir", { recursive: true });
    await bash.fs.writeFile("/dir/file.txt", "from fs\n");
    expect(await bash.exec("cat /dir/file.txt")).toMatchObject({
      stdout: "from fs\n",
      exitCode: 0,
    });

    await bash.exec("echo from exec > /dir/file.txt");
    expect(await bash.fs.readFile("/dir/file.txt")).toBe("from exec\n");
    expect(await bash.fs.readdir("/dir")).toEqual(["file.txt"]);
    expect((await bash.fs.stat("/dir/file.txt")).isFile).toBe(true);
  });

  it("preserves raw bytes through Bash.fs", async () => {
    const bash = new Bash({ cwd: "/" });
    const bytes = new Uint8Array([0, 0xff, 0x41]);

    await bash.fs.writeFile("/blob.bin", bytes);

    expect(await bash.fs.readFileBuffer("/blob.bin")).toEqual(bytes);
    expect(latin1FromBytes(await bash.fs.readFileBytes!("/blob.bin"))).toBe("\x00\xffA");
    expect(await bash.fs.readFile("/blob.bin", "binary")).toBe("\x00\xffA");
  });
});
