import { describe, expect, it } from "vite-plus/test";
import * as moonBash from "../../../src/wrapper/index.ts";
import {
  JUST_BASH_3_COMMAND_NAMES,
  JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES,
  JUST_BASH_3_NETWORK_COMMAND_NAMES,
  JUST_BASH_3_PYTHON_COMMAND_NAMES,
  JUST_BASH_3_ROOT_EXPORTS,
} from "../../../src/wrapper/compat/just-bash-3.ts";

describe("just-bash 3 public API surface", () => {
  it("exports every runtime root symbol required by just-bash 3.0.1", () => {
    const exported = Object.keys(moonBash).sort();
    for (const name of JUST_BASH_3_ROOT_EXPORTS) {
      expect(exported).toContain(name);
    }
  });

  it("reports upstream default command names in upstream order", () => {
    expect(moonBash.getCommandNames()).toEqual([...JUST_BASH_3_COMMAND_NAMES]);
  });

  it("reports optional command groups separately", () => {
    expect(moonBash.getNetworkCommandNames()).toEqual([...JUST_BASH_3_NETWORK_COMMAND_NAMES]);
    expect(moonBash.getPythonCommandNames()).toEqual([...JUST_BASH_3_PYTHON_COMMAND_NAMES]);
    expect(moonBash.getJavaScriptCommandNames()).toEqual([...JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES]);
  });

  it("supports dynamic Bash.registerCommand registration", async () => {
    const bash = new moonBash.Bash({ commands: ["greet"] });
    bash.registerCommand(
      moonBash.defineCommand("greet", async (args) => ({
        stdout: `hello ${args[0] ?? "world"}\n`,
        stderr: "",
        exitCode: 0,
      })),
    );

    const result = await bash.exec("greet moon");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello moon\n");
  });
});
