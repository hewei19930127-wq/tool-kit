import { describe, expect, it } from "vitest";
import { findMatches, overlayMatches, SEARCH_MATCH_LIMIT } from "./search";

describe("findMatches", () => {
  it("finds matches case-insensitively", () => {
    expect(findMatches("Hello hello HELLO", "hello")).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
      { start: 12, end: 17 },
    ]);
  });

  it("returns no matches for an empty query or empty text", () => {
    expect(findMatches("anything", "")).toEqual([]);
    expect(findMatches("", "x")).toEqual([]);
  });

  it("returns non-overlapping matches", () => {
    expect(findMatches("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it("handles CJK text", () => {
    expect(findMatches("你好世界你好", "你好")).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
  });

  it("caps the number of matches", () => {
    const text = "ab".repeat(SEARCH_MATCH_LIMIT + 5);
    expect(findMatches(text, "ab")).toHaveLength(SEARCH_MATCH_LIMIT);
  });
});

describe("overlayMatches", () => {
  it("passes chunks through untouched without matches", () => {
    const chunks = [
      { text: "abc", meta: "x" },
      { text: "def", meta: "y" },
    ];
    expect(overlayMatches(chunks, [])).toEqual([
      { text: "abc", meta: "x", start: 0, match: null },
      { text: "def", meta: "y", start: 3, match: null },
    ]);
  });

  it("splits a chunk around a match and reproduces the input exactly", () => {
    const runs = overlayMatches([{ text: '{"key": 1}', meta: "t" }], [{ start: 2, end: 5 }]);
    expect(runs).toEqual([
      { text: '{"', meta: "t", start: 0, match: null },
      { text: "key", meta: "t", start: 2, match: 0 },
      { text: '": 1}', meta: "t", start: 5, match: null },
    ]);
    expect(runs.map((run) => run.text).join("")).toBe('{"key": 1}');
  });

  it("carries a match index across chunk boundaries", () => {
    const runs = overlayMatches(
      [
        { text: "ab", meta: 1 },
        { text: "cd", meta: 2 },
      ],
      [{ start: 1, end: 3 }],
    );
    expect(runs).toEqual([
      { text: "a", meta: 1, start: 0, match: null },
      { text: "b", meta: 1, start: 1, match: 0 },
      { text: "c", meta: 2, start: 2, match: 0 },
      { text: "d", meta: 2, start: 3, match: null },
    ]);
  });

  it("assigns each match its own index", () => {
    const runs = overlayMatches(
      [{ text: "x-x-x", meta: null }],
      [
        { start: 0, end: 1 },
        { start: 2, end: 3 },
        { start: 4, end: 5 },
      ],
    );
    expect(runs.filter((run) => run.match != null).map((run) => run.match)).toEqual([0, 1, 2]);
  });
});
