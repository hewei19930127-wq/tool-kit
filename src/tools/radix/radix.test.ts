import { describe, expect, it } from "vitest";
import { convertRadix, toBinaryGroups } from "./radix";

describe("convertRadix", () => {
  it("converts hex to dec", () => {
    expect(convertRadix("ff", 16, 10)).toEqual({ ok: true, value: "255" });
  });

  it("converts dec to lowercase hex", () => {
    expect(convertRadix("255", 10, 16)).toEqual({ ok: true, value: "ff" });
  });

  it("converts bin to hex", () => {
    expect(convertRadix("11111111", 2, 16)).toEqual({
      ok: true,
      value: "ff",
    });
  });

  it("keeps full precision beyond Number.MAX_SAFE_INTEGER", () => {
    expect(convertRadix("ffffffffffffffff", 16, 10)).toEqual({
      ok: true,
      value: "18446744073709551615",
    });
  });

  it("handles negatives", () => {
    expect(convertRadix("-10", 10, 2)).toEqual({ ok: true, value: "-1010" });
  });

  it("rejects digits invalid for the source base", () => {
    expect(convertRadix("xyz", 10, 16).ok).toBe(false);
  });

  it("rejects an out-of-range base", () => {
    expect(convertRadix("1", 1, 10).ok).toBe(false);
  });
});

describe("toBinaryGroups", () => {
  it("groups binary into nibbles", () => {
    expect(toBinaryGroups(255n)).toBe("1111 1111");
  });
});
