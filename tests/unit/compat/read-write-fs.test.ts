import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  latin1FromBytes,
  ReadWriteFs,
} from "../../../wrapper/index.ts";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "moonbash-rwf-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("ReadWriteFs compatibility", () => {
  it("reads, writes, appends, stats, and lists real files under root", async () => {
    const root = makeRoot();
    writeFileSync(join(root, "initial.txt"), "initial");
    const fs = new ReadWriteFs({ root });

    expect(await fs.readFile("/initial.txt")).toBe("initial");

    await fs.writeFile("/dir/file.txt", "hello");
    await fs.appendFile("/dir/file.txt", " world");
    expect(readFileSync(join(root, "dir/file.txt"), "utf8")).toBe("hello world");
    expect(await fs.readFile("/dir/file.txt")).toBe("hello world");

    const stat = await fs.stat("/dir/file.txt");
    expect(stat.isFile).toBe(true);
    expect(stat.isDirectory).toBe(false);
    expect(stat.isSymbolicLink).toBe(false);
    expect(stat.size).toBe(11);
    expect(stat.mtime).toBeInstanceOf(Date);

    expect(await fs.readdir("/dir")).toEqual(["file.txt"]);
    expect(await fs.readdirWithFileTypes("/dir")).toEqual([
      {
        name: "file.txt",
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
      },
    ]);
  });

  it("handles binary reads, copy, move, chmod, remove, and utimes", async () => {
    const root = makeRoot();
    const fs = new ReadWriteFs({ root });
    const bytes = new Uint8Array([0, 0xff, 0x41]);

    await fs.writeFile("/blob.bin", bytes);
    expect(await fs.readFileBuffer("/blob.bin")).toEqual(bytes);
    expect(latin1FromBytes(await fs.readFileBytes("/blob.bin"))).toBe("\x00\xffA");
    expect(await fs.readFile("/blob.bin", "binary")).toBe("\x00\xffA");

    mkdirSync(join(root, "src/nested"), { recursive: true });
    writeFileSync(join(root, "src/a.txt"), "A");
    writeFileSync(join(root, "src/nested/b.txt"), "B");

    await fs.cp("/src", "/copy", { recursive: true });
    expect(await fs.readFile("/copy/nested/b.txt")).toBe("B");

    await fs.mv("/copy/a.txt", "/moved.txt");
    expect(await fs.readFile("/moved.txt")).toBe("A");
    expect(await fs.exists("/copy/a.txt")).toBe(false);

    await fs.chmod("/moved.txt", 0o600);
    expect((await fs.stat("/moved.txt")).mode & 0o777).toBe(0o600);

    const mtime = new Date("2026-05-16T00:00:00.000Z");
    await fs.utimes("/moved.txt", new Date(0), mtime);
    expect((await fs.stat("/moved.txt")).mtime.toISOString()).toBe(mtime.toISOString());

    await fs.rm("/copy", { recursive: true });
    expect(existsSync(join(root, "copy"))).toBe(false);
  });

  it("keeps all operations contained inside the configured root", async () => {
    const root = makeRoot();
    const outside = makeRoot();
    writeFileSync(join(outside, "secret.txt"), "secret");
    const fs = new ReadWriteFs({ root });

    expect(await fs.exists("/../secret.txt")).toBe(false);
    await expect(fs.readFile("/../secret.txt")).rejects.toThrow(/ENOENT|EACCES/);

    await fs.writeFile("/safe.txt", "safe");
    expect(await fs.realpath("/safe.txt")).toBe("/safe.txt");
    expect(fs.resolvePath("/", "../safe.txt")).toBe("/safe.txt");
    expect(fs.getAllPaths()).toEqual(["/safe.txt"]);
  });

  it("blocks symlink traversal by default but can allow safe symlinks", async () => {
    const root = makeRoot();
    const outside = makeRoot();
    writeFileSync(join(root, "target.txt"), "target");
    writeFileSync(join(outside, "secret.txt"), "secret");
    symlinkSync("target.txt", join(root, "safe-link.txt"));
    symlinkSync(join(outside, "secret.txt"), join(root, "escape-link.txt"));

    const blocked = new ReadWriteFs({ root });
    expect(await blocked.readlink("/safe-link.txt")).toBe("target.txt");
    expect((await blocked.lstat("/safe-link.txt")).isSymbolicLink).toBe(true);
    await expect(blocked.readFile("/safe-link.txt")).rejects.toThrow(/EACCES|ENOENT/);
    await expect(blocked.readFile("/escape-link.txt")).rejects.toThrow(/EACCES|ENOENT/);

    const allowed = new ReadWriteFs({ root, allowSymlinks: true });
    expect(await allowed.readFile("/safe-link.txt")).toBe("target");
    expect(await allowed.realpath("/safe-link.txt")).toBe("/target.txt");
    await expect(allowed.readFile("/escape-link.txt")).rejects.toThrow(/EACCES|ENOENT/);
  });
});
