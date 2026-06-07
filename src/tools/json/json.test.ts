import { describe, expect, it } from "vitest";
import {
  escapeJson,
  formatJson,
  minifyJson,
  sortJsonKeys,
  unescapeJson,
  validateJson,
} from "./json";

describe("formatJson", () => {
  it("pretty-prints valid JSON with 2-space indent", () => {
    const result = formatJson('{"b":1,"a":2}');
    expect(result).toEqual({ ok: true, value: '{\n  "b": 1,\n  "a": 2\n}' });
  });

  it("returns an error with a line/col for invalid JSON", () => {
    const result = formatJson('{"a": }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/./);
      expect(typeof result.line).toBe("number");
      expect(typeof result.col).toBe("number");
    }
  });

  it("handles empty input as an error, not a throw", () => {
    expect(formatJson("").ok).toBe(false);
  });

  it("round-trips unicode", () => {
    const result = formatJson('{"k":"café — 中文"}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("café — 中文");
  });
});

describe("minifyJson", () => {
  it("strips whitespace", () => {
    expect(minifyJson('{\n  "a": 1\n}')).toEqual({
      ok: true,
      value: '{"a":1}',
    });
  });
});

describe("validateJson", () => {
  it("confirms valid JSON without rewriting the input", () => {
    expect(validateJson('{"a":1}')).toEqual({
      ok: true,
      value: "Valid JSON",
      valueKey: "tools.json.messages.valid",
    });
  });

  it("returns parse details for invalid JSON", () => {
    const result = validateJson('{"a": }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/./);
      expect(typeof result.line).toBe("number");
      expect(typeof result.col).toBe("number");
    }
  });
});

describe("escapeJson / unescapeJson", () => {
  it("escapes a raw string into a JSON string literal", () => {
    expect(escapeJson('he said "hi"\n')).toEqual({
      ok: true,
      value: '"he said \\"hi\\"\\n"',
    });
  });

  it("unescapes a JSON string literal back to raw text", () => {
    expect(unescapeJson('"he said \\"hi\\"\\n"')).toEqual({
      ok: true,
      value: 'he said "hi"\n',
    });
  });

  it("unescape rejects a non-string literal", () => {
    expect(unescapeJson("{}").ok).toBe(false);
  });
});

describe("sortJsonKeys", () => {
  it("sorts object keys recursively, preserving arrays", () => {
    const result = sortJsonKeys('{"b":1,"a":{"d":4,"c":[3,2,1]}}');
    expect(result).toEqual({
      ok: true,
      value:
        '{\n  "a": {\n    "c": [\n      3,\n      2,\n      1\n    ],\n    "d": 4\n  },\n  "b": 1\n}',
    });
  });
});
