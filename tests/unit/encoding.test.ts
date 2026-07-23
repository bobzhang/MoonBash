import { describe, expect, it } from "vite-plus/test";
import {
  bytesOutput,
  decodeBytesToUtf8,
  EMPTY_BYTES,
  encodeUtf8ToBytes,
  latin1FromBytes,
  stdoutAsBytes,
  stdoutKind,
  textOutput,
  unsafeBytesFromLatin1,
} from "../../wrapper/index.ts";

describe("ByteString compatibility helpers", () => {
  it("round-trips UTF-8 text through byte helpers", () => {
    const bytes = encodeUtf8ToBytes("hello 你好");
    expect(decodeBytesToUtf8(bytes)).toBe("hello 你好");
  });

  it("preserves latin1 byte buffers without decoding when requested", () => {
    const raw = "\x00\xffA";
    const bytes = unsafeBytesFromLatin1(raw);
    expect(latin1FromBytes(bytes)).toBe(raw);
  });

  it("exposes EMPTY_BYTES", () => {
    expect(latin1FromBytes(EMPTY_BYTES)).toBe("");
  });

  it("marks text and bytes output kinds", () => {
    const text = { stdout: "hello", stderr: "", exitCode: 0, ...textOutput("hello") };
    expect(stdoutKind(text)).toBe("text");
    expect(decodeBytesToUtf8(stdoutAsBytes(text))).toBe("hello");

    const raw = unsafeBytesFromLatin1("\x1f\x8b");
    const bytes = { stdout: "\x1f\x8b", stderr: "", exitCode: 0, ...bytesOutput(raw) };
    expect(stdoutKind(bytes)).toBe("bytes");
    expect(latin1FromBytes(stdoutAsBytes(bytes))).toBe("\x1f\x8b");
  });
});
