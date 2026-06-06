import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64 } from "./base64";

describe("encodeBase64", () => {
  it("encodes ASCII", () => {
    expect(encodeBase64("hi")).toEqual({ ok: true, value: "aGk=" });
  });

  it("is UTF-8 safe", () => {
    expect(encodeBase64("café")).toEqual({ ok: true, value: "Y2Fmw6k=" });
  });

  it("produces the URL-safe variant without +, /, or padding", () => {
    const result = encodeBase64("<<???>>", true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toMatch(/[+/=]/);
  });
});

describe("decodeBase64", () => {
  it("round-trips unicode", () => {
    const encoded = encodeBase64("café — 中文");
    expect(encoded.ok).toBe(true);
    if (encoded.ok) {
      expect(decodeBase64(encoded.value)).toEqual({
        ok: true,
        value: "café — 中文",
      });
    }
  });

  it("decodes the URL-safe variant", () => {
    const encoded = encodeBase64("a/b+c", true);
    if (encoded.ok) {
      expect(decodeBase64(encoded.value, true)).toEqual({
        ok: true,
        value: "a/b+c",
      });
    }
  });

  it("errors on empty input", () => {
    expect(decodeBase64("").ok).toBe(false);
  });

  it("errors on non-base64 garbage", () => {
    expect(decodeBase64("!!!not base64!!!").ok).toBe(false);
  });
});
