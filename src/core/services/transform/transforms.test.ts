import { describe, expect, it } from "vitest";
import { TRANSFORMS } from "./transforms";

describe("TRANSFORMS registry", () => {
  it("formats JSON via the json.format op", () => {
    expect(TRANSFORMS["json.format"]('{"b":1}')).toEqual({
      ok: true,
      value: '{\n  "b": 1\n}',
    });
  });

  it("minifies XML via the xml.minify op", () => {
    const result = TRANSFORMS["xml.minify"]("<a>\n  <b>1</b>\n</a>");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toContain("\n");
  });

  it("honours an indent option", () => {
    const result = TRANSFORMS["json.format"]('{"a":1}', { indent: 4 });
    if (result.ok) expect(result.value).toBe('{\n    "a": 1\n}');
  });
});
