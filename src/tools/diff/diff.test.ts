import { describe, expect, it } from "vitest";
import { computeDiff, diffStats } from "./diff";

describe("computeDiff (line)", () => {
  it("marks a changed line as removed and added", () => {
    const parts = computeDiff("a\nb\n", "a\nc\n", "line");
    expect(parts.some((part) => part.removed && part.value.includes("b"))).toBe(true);
    expect(parts.some((part) => part.added && part.value.includes("c"))).toBe(true);
    expect(parts.some((part) => !part.added && !part.removed && part.value.includes("a"))).toBe(
      true,
    );
  });
});

describe("computeDiff (word)", () => {
  it("isolates the inserted word", () => {
    const parts = computeDiff("hello world", "hello brave world", "word");
    expect(parts.some((part) => part.added && part.value.includes("brave"))).toBe(true);
  });
});

describe("diffStats", () => {
  it("counts added and removed parts", () => {
    const parts = computeDiff("a\nb\n", "a\nc\n", "line");
    expect(diffStats(parts)).toEqual({ added: 1, removed: 1 });
  });
});
