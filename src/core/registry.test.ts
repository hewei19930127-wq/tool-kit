import { describe, expect, it } from "vitest";
import { getTool, tools } from "./registry";

describe("registry", () => {
  it("contains the JSON tool", () => {
    expect(getTool("json")?.name).toBe("JSON");
  });

  it("has unique tool ids", () => {
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for an unknown id", () => {
    expect(getTool("does-not-exist")).toBeUndefined();
  });
});
