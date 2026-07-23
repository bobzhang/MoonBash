declare const __byteString: unique symbol;

export interface ByteString {
  readonly [__byteString]: true;
}

export type OutputKind = "text" | "bytes";

const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

export function unsafeBytesFromLatin1(s: string): ByteString {
  return s as unknown as ByteString;
}

export function latin1FromBytes(b: ByteString): string {
  return b as unknown as string;
}

export function decodeBytesToUtf8(b: ByteString): string {
  const s = b as unknown as string;
  if (!s) return s;

  let hasHighByte = false;
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code > 0xff) return s;
    if (code > 0x7f) hasHighByte = true;
  }
  if (!hasHighByte) return s;

  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) {
    bytes[i] = s.charCodeAt(i);
  }

  try {
    return strictUtf8Decoder.decode(bytes);
  } catch {
    return s;
  }
}

export function encodeUtf8ToBytes(s: string): ByteString {
  if (!s) return "" as unknown as ByteString;
  const bytes = utf8Encoder.encode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out as unknown as ByteString;
}

export const EMPTY_BYTES: ByteString = "" as unknown as ByteString;

export function bytesFromUint8Array(buf: Uint8Array): ByteString {
  let out = "";
  for (let i = 0; i < buf.length; i += 1) {
    out += String.fromCharCode(buf[i]);
  }
  return out as unknown as ByteString;
}

export function uint8ArrayFromBytes(bytes: ByteString): Uint8Array {
  const raw = latin1FromBytes(bytes);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i) & 0xff;
  }
  return out;
}

export function stdoutKind(result: { stdoutKind?: OutputKind; stdoutEncoding?: "binary" }): OutputKind {
  if (result.stdoutKind) return result.stdoutKind;
  return result.stdoutEncoding === "binary" ? "bytes" : "text";
}

export function stdoutAsBytes(result: {
  stdout: string;
  stdoutKind?: OutputKind;
  stdoutEncoding?: "binary";
}): ByteString {
  return stdoutKind(result) === "bytes"
    ? unsafeBytesFromLatin1(result.stdout)
    : encodeUtf8ToBytes(result.stdout);
}

export function textOutput(data: string): { stdout: string; stdoutKind: "text" } {
  return { stdout: data, stdoutKind: "text" };
}

export function bytesOutput(data: ByteString): {
  stdout: string;
  stdoutKind: "bytes";
  stdoutEncoding: "binary";
} {
  return {
    stdout: latin1FromBytes(data),
    stdoutKind: "bytes",
    stdoutEncoding: "binary",
  };
}
