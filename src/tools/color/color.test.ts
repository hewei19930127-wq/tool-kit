import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor, wcagLevels } from "./color";

describe("parseColor", () => {
  it("converts hex to every model", () => {
    const result = parseColor("#ff0000");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hex).toBe("#ff0000");
      expect(result.value.rgb).toBe("rgb(255, 0, 0)");
      expect(result.value.hsl).toBe("hsl(0, 100%, 50%)");
      expect(result.value.hsv).toBe("hsv(0, 100%, 100%)");
    }
  });

  it("accepts rgb() input", () => {
    const result = parseColor("rgb(0, 0, 255)");
    if (result.ok) expect(result.value.hex).toBe("#0000ff");
  });

  it("errors on an unrecognized color", () => {
    expect(parseColor("not-a-color").ok).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    const result = contrastRatio("#000000", "#ffffff");
    if (result.ok) expect(result.value).toBeCloseTo(21, 1);
  });

  it("errors when a color is invalid", () => {
    expect(contrastRatio("#000", "nope").ok).toBe(false);
  });
});

describe("wcagLevels", () => {
  it("passes all levels at 21", () => {
    expect(wcagLevels(21)).toEqual({ aaLarge: true, aa: true, aaa: true });
  });

  it("passes AA but not AAA at 4.5", () => {
    expect(wcagLevels(4.5)).toEqual({
      aaLarge: true,
      aa: true,
      aaa: false,
    });
  });
});
