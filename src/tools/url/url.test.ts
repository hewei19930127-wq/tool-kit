import { describe, expect, it } from "vitest";
import { decodeUrlComponent, encodeUrlComponent, encodeUrlFull, parseQuery } from "./url";

describe("URL component encode/decode", () => {
  it("encodes reserved characters", () => {
    expect(encodeUrlComponent("a b&c=d")).toEqual({
      ok: true,
      value: "a%20b%26c%3Dd",
    });
  });

  it("round-trips", () => {
    const encoded = encodeUrlComponent("名前=テスト");
    if (encoded.ok) {
      expect(decodeUrlComponent(encoded.value)).toEqual({
        ok: true,
        value: "名前=テスト",
      });
    }
  });

  it("errors on malformed percent-encoding", () => {
    expect(decodeUrlComponent("%E0%A4%A").ok).toBe(false);
  });
});

describe("encodeUrlFull", () => {
  it("preserves URL structure but encodes spaces", () => {
    expect(encodeUrlFull("https://x.com/a b?q=1")).toEqual({
      ok: true,
      value: "https://x.com/a%20b?q=1",
    });
  });
});

describe("parseQuery", () => {
  it("parses a full URL's query into key/value rows", () => {
    expect(parseQuery("https://x.com/p?a=1&b=two")).toEqual({
      ok: true,
      value: [
        { key: "a", value: "1" },
        { key: "b", value: "two" },
      ],
    });
  });

  it("parses a bare query string", () => {
    expect(parseQuery("?x=1&y=2")).toEqual({
      ok: true,
      value: [
        { key: "x", value: "1" },
        { key: "y", value: "2" },
      ],
    });
  });

  it("errors on empty input", () => {
    expect(parseQuery("").ok).toBe(false);
  });
});
