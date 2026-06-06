import { describe, expect, it } from "vitest";
import {
  convertTimezone,
  formatCustom,
  relativeFrom,
  toEpochMillis,
  toEpochSeconds,
  toIso,
} from "./time";

describe("toIso", () => {
  it("treats zero as the Unix epoch", () => {
    expect(toIso("0")).toEqual({ ok: true, value: "1970-01-01T00:00:00.000Z" });
  });

  it("treats non-10-digit integers as epoch millis", () => {
    expect(toIso("1000")).toEqual({
      ok: true,
      value: "1970-01-01T00:00:01.000Z",
    });
  });

  it("treats 10-digit integers as epoch seconds", () => {
    expect(toIso("1700000000")).toEqual({
      ok: true,
      value: "2023-11-14T22:13:20.000Z",
    });
  });

  it("errors on gibberish", () => {
    expect(toIso("not-a-date").ok).toBe(false);
  });
});

describe("epoch conversions", () => {
  it("ISO to epoch seconds", () => {
    expect(toEpochSeconds("1970-01-01T00:00:00Z")).toEqual({
      ok: true,
      value: "0",
    });
  });

  it("ISO to epoch millis", () => {
    expect(toEpochMillis("1970-01-01T00:00:01Z")).toEqual({
      ok: true,
      value: "1000",
    });
  });
});

describe("formatCustom", () => {
  it("formats with a pattern in UTC by default", () => {
    expect(formatCustom("0", "YYYY-MM-DD HH:mm:ss")).toEqual({
      ok: true,
      value: "1970-01-01 00:00:00",
    });
  });
});

describe("convertTimezone", () => {
  it("shifts an instant into a zone", () => {
    expect(convertTimezone("1970-01-01T00:00:00Z", "Asia/Tokyo")).toEqual({
      ok: true,
      value: "1970-01-01 09:00:00",
    });
  });

  it("errors on an unknown zone", () => {
    expect(convertTimezone("0", "Not/AZone").ok).toBe(false);
  });
});

describe("relativeFrom", () => {
  it("describes the past relative to a base instant", () => {
    const result = relativeFrom("0", 3_600_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatch(/ago/);
  });
});
