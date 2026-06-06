import { describe, expect, it } from "vitest";
import { runRegex } from "./regex";

describe("runRegex", () => {
  it("finds all global matches with indices", () => {
    const result = runRegex("\\d+", "g", "a1b22c");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((match) => match.match)).toEqual(["1", "22"]);
      expect(result.value[1].index).toBe(3);
    }
  });

  it("captures groups", () => {
    const result = runRegex("(\\w)(\\d)", "", "x9");
    if (result.ok) expect(result.value[0].groups).toEqual(["x", "9"]);
  });

  it("returns an empty list when nothing matches", () => {
    const result = runRegex("z", "g", "abc");
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("reports an invalid pattern instead of throwing", () => {
    expect(runRegex("(", "", "x").ok).toBe(false);
  });

  it("does not hang on a zero-width global match", () => {
    const result = runRegex("a*", "g", "aa");
    expect(result.ok).toBe(true);
  });
});
