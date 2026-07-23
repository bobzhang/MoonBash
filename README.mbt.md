# MoonBash

MoonBash is a pure-memory POSIX shell sandbox written in MoonBit. It compiles to pure JavaScript, keeps execution inside an in-memory filesystem, and is designed for embedding in AI agents, browser terminals, and serverless runtimes.

This MoonBit module publishes the core runtime packages. The TypeScript wrapper and website demo stay in the GitHub repository and are excluded from the mooncakes package.

## Install

```bash
moon add Haoxincode/moonbash
```

## Public package

The main entry package is:

```text
Haoxincode/moonbash/lib/entry
```

It exports:

- `execute`
- `execute_with_fs`
- `execute_with_state`

## Example

Add the dependency in your `moon.pkg`:

```moonbit nocheck
import {
  "Haoxincode/moonbash/lib/entry",
}
```

Then call it from MoonBit. Each call returns a JSON string with `stdout`, `stderr`, and `exitCode`. The code blocks below are live: `moon check` type-checks them and `moon test` runs them.

```mbt check
///|
test "run a script in the sandbox" {
  let result = @entry.execute("echo hello from moonbash")
  inspect(
    result,
    content=(
      #|{"stdout":"hello from moonbash\n","stderr":"","exitCode":0}
    ),
  )
}
```

Scripts run against an in-memory virtual filesystem — no real disk is touched:

```mbt check
///|
test "pipelines and the in-memory filesystem" {
  let result = @entry.execute(
    "printf 'hello a\\nbye\\nhello b\\n' > notes.txt && grep -c hello notes.txt",
  )
  inspect(
    result,
    content=(
      #|{"stdout":"2\n","stderr":"","exitCode":0}
    ),
  )
}
```

Use `execute_with_fs` / `execute_with_state` to seed files, environment, and working directory up front, and to get a filesystem snapshot back with the result.

## Repository

- GitHub: <https://github.com/Haoxincode/MoonBash>
- Docs: <https://github.com/Haoxincode/MoonBash/tree/main/docs>
