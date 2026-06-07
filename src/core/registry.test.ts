import { describe, expect, it } from "vitest";
import { getTool, tools } from "./registry";

describe("registry", () => {
  it("contains the JSON tool", () => {
    expect(getTool("json")?.nameKey).toBe("tools.json.name");
  });

  it("contains all Phase-1 tools", () => {
    for (const id of ["json", "base64", "url", "time", "diff"]) {
      expect(getTool(id)).toBeDefined();
    }
  });

  it("contains all Phase-2 tools", () => {
    for (const id of ["xml", "radix", "cron", "regex", "color"]) {
      expect(getTool(id)).toBeDefined();
    }
  });

  it("lets epoch-like clipboard content resolve to Time, not JSON or Base64", () => {
    expect(getTool("json")?.detectClipboard?.("1700000000")).toBe(false);
    expect(getTool("base64")?.detectClipboard?.("1700000000")).toBe(false);
    expect(getTool("time")?.detectClipboard?.("1700000000")).toBe(true);
  });

  it("has unique tool ids", () => {
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for an unknown id", () => {
    expect(getTool("does-not-exist")).toBeUndefined();
  });
});
