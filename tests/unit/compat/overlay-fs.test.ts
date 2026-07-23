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
  OverlayFs,
} from "../../../wrapper/index.ts";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "moonbash-overlay-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("OverlayFs compatibility", () => {
  it("reads from the real root at the configured mount point", async () => {
    const root = makeRoot();
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "README.md"), "real readme");
    writeFileSync(join(root, "src/app.txt"), "app");

    const fs = new OverlayFs({ root, mountPoint: "/workspace" });

    expect(fs.getMountPoint()).toBe("/workspace");
    expect(await fs.readFile("/workspace/README.md")).toBe("real readme");
    expect(await fs.readFile("/workspace/src/app.txt")).toBe("app");
    expect(await fs.readdir("/workspace")).toEqual(["README.md", "src"]);
    expect(await fs.readdirWithFileTypes("/workspace/src")).toEqual([
      {
        name: "app.txt",
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
      },
    ]);
    expect(await fs.exists("/outside/README.md")).toBe(false);
  });

  it("keeps writes, appends, chmod, and utimes in memory without touching disk", async () => {
    const root = makeRoot();
    writeFileSync(join(root, "notes.txt"), "real");
    const fs = new OverlayFs({ root, mountPoint: "/" });

    await fs.writeFile("/notes.txt", "overlay");
    await fs.appendFile("/notes.txt", " layer");
    expect(await fs.readFile("/notes.txt")).toBe("overlay layer");
    expect(readFileSync(join(root, "notes.txt"), "utf8")).toBe("real");

    await fs.chmod("/notes.txt", 0o600);
    expect((await fs.stat("/notes.txt")).mode & 0o777).toBe(0o600);

    const mtime = new Date("2026-05-16T00:00:00.000Z");
    await fs.utimes("/notes.txt", new Date(0), mtime);
    expect((await fs.stat("/notes.txt")).mtime.toISOString()).toBe(mtime.toISOString());
    expect(readFileSync(join(root, "notes.txt"), "utf8")).toBe("real");
  });

  it("uses tombstones for deletes while leaving the real filesystem intact", async () => {
    const root = makeRoot();
    mkdirSync(join(root, "dir"), { recursive: true });
    writeFileSync(join(root, "dir/real.txt"), "real");
    const fs = new OverlayFs({ root, mountPoint: "/" });

    expect(await fs.readdir("/dir")).toEqual(["real.txt"]);

    await fs.rm("/dir/real.txt");
    expect(await fs.exists("/dir/real.txt")).toBe(false);
    await expect(fs.readFile("/dir/real.txt")).rejects.toThrow(/ENOENT/);
    expect(readFileSync(join(root, "dir/real.txt"), "utf8")).toBe("real");
    expect(await fs.readdir("/dir")).toEqual([]);

    await fs.writeFile("/dir/real.txt", "replacement");
    expect(await fs.readFile("/dir/real.txt")).toBe("replacement");
    expect(readFileSync(join(root, "dir/real.txt"), "utf8")).toBe("real");
  });

  it("supports copy, move, binary reads, hard links, and virtual symlinks in overlay memory", async () => {
    const root = makeRoot();
    writeFileSync(join(root, "blob.bin"), new Uint8Array([0, 0xff, 0x41]));
    const fs = new OverlayFs({ root, mountPoint: "/", allowSymlinks: true });

    expect(latin1FromBytes(await fs.readFileBytes("/blob.bin"))).toBe("\x00\xffA");

    await fs.cp("/blob.bin", "/copy.bin");
    await fs.mv("/copy.bin", "/moved.bin");
    expect(await fs.readFile("/moved.bin", "binary")).toBe("\x00\xffA");
    expect(existsSync(join(root, "moved.bin"))).toBe(false);

    await fs.link("/moved.bin", "/linked.bin");
    expect(await fs.readFile("/linked.bin", "binary")).toBe("\x00\xffA");

    await fs.symlink("moved.bin", "/link.bin");
    expect(await fs.readlink("/link.bin")).toBe("moved.bin");
    expect((await fs.lstat("/link.bin")).isSymbolicLink).toBe(true);
    expect(await fs.readFile("/link.bin", "binary")).toBe("\x00\xffA");
    expect(await fs.realpath("/link.bin")).toBe("/moved.bin");
  });

  it("blocks writes in read-only mode", async () => {
    const root = makeRoot();
    writeFileSync(join(root, "real.txt"), "real");
    const fs = new OverlayFs({ root, mountPoint: "/", readOnly: true });

    expect(await fs.readFile("/real.txt")).toBe("real");
    await expect(fs.writeFile("/new.txt", "nope")).rejects.toThrow(/EROFS/);
    await expect(fs.rm("/real.txt")).rejects.toThrow(/EROFS/);
    await expect(fs.chmod("/real.txt", 0o600)).rejects.toThrow(/EROFS/);
  });

  it("allows sync memory initialization even in read-only mode", async () => {
    const root = makeRoot();
    const fs = new OverlayFs({ root, mountPoint: "/", readOnly: true });

    fs.mkdirSync("/seed");
    fs.writeFileSync("/seed/file.txt", "seeded");

    expect(await fs.readFile("/seed/file.txt")).toBe("seeded");
    expect(existsSync(join(root, "seed/file.txt"))).toBe(false);
    await expect(fs.writeFile("/seed/async.txt", "nope")).rejects.toThrow(/EROFS/);
  });

  it("blocks real symlink traversal by default and keeps paths contained", async () => {
    const root = makeRoot();
    const outside = makeRoot();
    writeFileSync(join(root, "target.txt"), "target");
    writeFileSync(join(outside, "secret.txt"), "secret");
    symlinkSync("target.txt", join(root, "safe-link.txt"));
    symlinkSync(join(outside, "secret.txt"), join(root, "escape-link.txt"));

    const blocked = new OverlayFs({ root, mountPoint: "/" });
    expect(await blocked.readlink("/safe-link.txt")).toBe("target.txt");
    expect((await blocked.lstat("/safe-link.txt")).isSymbolicLink).toBe(true);
    await expect(blocked.readFile("/safe-link.txt")).rejects.toThrow(/ENOENT|EACCES/);
    await expect(blocked.readFile("/escape-link.txt")).rejects.toThrow(/ENOENT|EACCES/);

    const allowed = new OverlayFs({ root, mountPoint: "/", allowSymlinks: true });
    expect(await allowed.readFile("/safe-link.txt")).toBe("target");
    expect(await allowed.realpath("/safe-link.txt")).toBe("/target.txt");
    await expect(allowed.readFile("/escape-link.txt")).rejects.toThrow(/ENOENT|EACCES/);
  });
});
