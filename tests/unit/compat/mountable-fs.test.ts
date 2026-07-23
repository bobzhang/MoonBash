import { describe, expect, it } from "vite-plus/test";
import {
  InMemoryFs,
  latin1FromBytes,
  MountableFs,
} from "../../../wrapper/index.ts";

describe("MountableFs compatibility", () => {
  it("routes file operations to the longest matching mount", async () => {
    const base = new InMemoryFs({ "/base.txt": "base" });
    const mounted = new InMemoryFs({ "/file.txt": "mounted" });
    const fs = new MountableFs({ base });

    fs.mount("/mnt/data", mounted);

    expect(await fs.readFile("/base.txt")).toBe("base");
    expect(await fs.readFile("/mnt/data/file.txt")).toBe("mounted");

    await fs.writeFile("/mnt/data/new.txt", "new");
    expect(await mounted.readFile("/new.txt")).toBe("new");
    expect(await fs.readFile("/mnt/data/new.txt")).toBe("new");
    expect(await fs.exists("/mnt/data")).toBe(true);
    expect(await fs.exists("/mnt")).toBe(true);
  });

  it("manages mounts and rejects ambiguous mount points", () => {
    const fs = new MountableFs();
    const mounted = new InMemoryFs();

    fs.mount("/mnt/data", mounted);

    expect(fs.isMountPoint("/mnt/data")).toBe(true);
    expect(fs.getMounts()).toEqual([{ mountPoint: "/mnt/data", filesystem: mounted }]);
    expect(() => fs.mount("/", new InMemoryFs())).toThrow(/Cannot mount at root/);
    expect(() => fs.mount("/mnt/data/nested", new InMemoryFs())).toThrow(/inside existing mount/);
    expect(() => fs.mount("/mnt", new InMemoryFs())).toThrow(/would contain existing mount/);
    expect(() => fs.mount("/bad/../mount", new InMemoryFs())).toThrow(/contains '\.' or '\.\.'/);

    fs.unmount("/mnt/data");
    expect(fs.isMountPoint("/mnt/data")).toBe(false);
    expect(() => fs.unmount("/mnt/data")).toThrow(/No filesystem mounted/);
  });

  it("merges base directory entries with mounted child directories", async () => {
    const base = new InMemoryFs({
      "/workspace/base.txt": "base",
    });
    const fs = new MountableFs({
      base,
      mounts: [
        {
          mountPoint: "/workspace/vendor",
          filesystem: new InMemoryFs({ "/pkg.json": "{}" }),
        },
      ],
    });

    expect(await fs.readdir("/workspace")).toEqual(["base.txt", "vendor"]);
    expect(await fs.readdir("/workspace/vendor")).toEqual(["pkg.json"]);

    const stat = await fs.stat("/workspace/vendor");
    expect(stat.isDirectory).toBe(true);
    expect(stat.isFile).toBe(false);
    expect(await fs.lstat("/workspace/vendor")).toMatchObject({
      isDirectory: true,
      isSymbolicLink: false,
    });
  });

  it("copies and moves across mounted filesystems recursively", async () => {
    const base = new InMemoryFs();
    const left = new InMemoryFs({
      "/dir/a.txt": "A",
      "/dir/nested/b.txt": "B",
    });
    const right = new InMemoryFs();
    const fs = new MountableFs({
      base,
      mounts: [
        { mountPoint: "/left", filesystem: left },
        { mountPoint: "/right", filesystem: right },
      ],
    });

    await fs.cp("/left/dir", "/right/copied", { recursive: true });
    expect(await right.readFile("/copied/a.txt")).toBe("A");
    expect(await right.readFile("/copied/nested/b.txt")).toBe("B");

    await fs.mv("/right/copied/a.txt", "/left/moved.txt");
    expect(await left.readFile("/moved.txt")).toBe("A");
    expect(await right.exists("/copied/a.txt")).toBe(false);
  });

  it("preserves byte reads and prevents removing mount points", async () => {
    const mounted = new InMemoryFs({
      "/blob.bin": new Uint8Array([0, 0xff, 0x41]),
    });
    const fs = new MountableFs({
      mounts: [{ mountPoint: "/mnt", filesystem: mounted }],
    });

    expect(await fs.readFileBuffer("/mnt/blob.bin")).toEqual(new Uint8Array([0, 0xff, 0x41]));
    expect(latin1FromBytes(await fs.readFileBytes("/mnt/blob.bin"))).toBe("\x00\xffA");
    await expect(fs.rm("/mnt")).rejects.toThrow(/EBUSY/);
    await expect(fs.rm("/mnt/blob.bin")).resolves.toBeUndefined();
  });
});
