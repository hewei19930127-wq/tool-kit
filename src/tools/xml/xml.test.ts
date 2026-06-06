import { describe, expect, it } from "vitest";
import { formatXml, minifyXml, validateXml } from "./xml";

describe("validateXml", () => {
  it("accepts well-formed XML", () => {
    expect(validateXml("<a><b/></a>")).toEqual({
      ok: true,
      value: "Well-formed",
    });
  });

  it("rejects mismatched tags with a location", () => {
    const result = validateXml("<a></b>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.line).toBe("number");
  });

  it("errors on empty input", () => {
    expect(validateXml("").ok).toBe(false);
  });
});

describe("formatXml", () => {
  it("indents nested elements", () => {
    const result = formatXml("<a><b>1</b></a>");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("<b>1</b>");
      expect(result.value.split("\n").length).toBeGreaterThan(1);
    }
  });

  it("preserves attributes", () => {
    const result = formatXml('<a x="1"><b/></a>');
    if (result.ok) expect(result.value).toContain('x="1"');
  });

  it("surfaces malformed input as an error", () => {
    expect(formatXml("<a><b></a>").ok).toBe(false);
  });
});

describe("minifyXml", () => {
  it("collapses a pretty document to one line", () => {
    const pretty = "<a>\n  <b>1</b>\n</a>";
    const result = minifyXml(pretty);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toContain("\n");
  });
});
