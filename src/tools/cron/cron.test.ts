import { describe, expect, it } from "vitest";
import { describeCron, nextRuns } from "./cron";

describe("describeCron", () => {
  it("describes a simple expression", () => {
    const result = describeCron("*/5 * * * *");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toLowerCase()).toContain("every 5 minutes");
  });

  it("errors on an invalid expression", () => {
    expect(describeCron("nonsense").ok).toBe(false);
  });
});

describe("nextRuns", () => {
  it("returns the next N runs from a base instant in UTC", () => {
    const base = Date.UTC(2024, 0, 1, 12, 0, 0);
    expect(nextRuns("0 0 * * *", 2, base, "UTC")).toEqual({
      ok: true,
      value: ["2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"],
    });
  });

  it("errors on an invalid expression", () => {
    expect(nextRuns("not a cron", 3, 0, "UTC").ok).toBe(false);
  });
});
