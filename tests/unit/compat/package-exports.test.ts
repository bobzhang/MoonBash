import { describe, expect, it } from "vite-plus/test";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "../../..");

function formatDiagnostics(diagnostics: ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
}

describe("package export compatibility", () => {
  it("declares just-bash compatible root, require, and browser subpath exports", async () => {
    const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

    expect(pkg.main).toBe("dist/index.mjs");
    expect(pkg.types).toBe("dist/index.d.mts");
    expect(pkg.exports["."]).toEqual({
      browser: "./dist/browser.mjs",
      require: {
        types: "./dist/index.d.cts",
        default: "./dist/index.cjs",
      },
      import: {
        types: "./dist/index.d.mts",
        default: "./dist/index.mjs",
      },
    });
    expect(pkg.exports["./browser"]).toEqual({
      types: "./dist/browser.d.mts",
      import: "./dist/browser.mjs",
    });
    expect(pkg.files).toContain("dist/");
  });

  it("builds ESM, CJS, and browser entry artifacts", () => {
    for (const path of [
      "dist/index.mjs",
      "dist/index.cjs",
      "dist/index.d.mts",
      "dist/index.d.cts",
      "dist/browser.mjs",
      "dist/browser.d.mts",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  it("loads built root entry through import and require", async () => {
    const esm = await import(resolve(root, "dist/index.mjs"));
    const require = createRequire(import.meta.url);
    const cjs = require(resolve(root, "dist/index.cjs"));

    for (const mod of [esm, cjs]) {
      expect(typeof mod.Bash).toBe("function");
      expect(typeof mod.Sandbox).toBe("function");
      expect(typeof mod.OverlayFs).toBe("function");
      expect(typeof mod.ReadWriteFs).toBe("function");
      expect(mod.getCommandNames()).toContain("echo");
    }
  });

  it("loads built browser subpath without Node-only filesystem exports", async () => {
    const browser = await import(resolve(root, "dist/browser.mjs"));

    expect(typeof browser.Bash).toBe("function");
    expect(typeof browser.InMemoryFs).toBe("function");
    expect(typeof browser.MountableFs).toBe("function");
    expect("OverlayFs" in browser).toBe(false);
    expect("ReadWriteFs" in browser).toBe(false);
    expect("Sandbox" in browser).toBe(false);
  });

  it("provides value declarations for CommonJS consumers", async () => {
    const dir = resolve(root, ".tmp/package-export-types");
    const fileName = resolve(dir, "consumer.cts");

    await rm(dir, { force: true, recursive: true });
    await mkdir(dir, { recursive: true });
    await writeFile(fileName, `
import moonBash = require("moon-bash");

const bash = new moonBash.Bash();
const overlay: typeof moonBash.OverlayFs = moonBash.OverlayFs;
const readWrite: typeof moonBash.ReadWriteFs = moonBash.ReadWriteFs;
const sandbox: Promise<moonBash.Sandbox> = moonBash.Sandbox.create();

void bash;
void overlay;
void readWrite;
void sandbox;
`, "utf8");

    const program = ts.createProgram([fileName], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: ["node"],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    await rm(dir, { force: true, recursive: true });
    expect(formatDiagnostics(diagnostics)).toBe("");
  });
});
