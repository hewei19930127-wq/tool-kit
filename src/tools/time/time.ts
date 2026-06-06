import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { ToolResult } from "@/core/types";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

const ERR: ToolResult = { ok: false, error: "Unrecognized date/time input" };

function parse(input: string): dayjs.Dayjs | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    const ms = trimmed.length === 10 ? num * 1000 : num;
    const date = dayjs(ms);
    return date.isValid() ? date : null;
  }

  const date = dayjs(trimmed);
  return date.isValid() ? date : null;
}

export function toIso(input: string): ToolResult {
  const date = parse(input);
  return date ? { ok: true, value: date.utc().toISOString() } : ERR;
}

export function toEpochSeconds(input: string): ToolResult {
  const date = parse(input);
  return date ? { ok: true, value: String(date.unix()) } : ERR;
}

export function toEpochMillis(input: string): ToolResult {
  const date = parse(input);
  return date ? { ok: true, value: String(date.valueOf()) } : ERR;
}

export function formatCustom(input: string, pattern: string, tz?: string): ToolResult {
  const date = parse(input);
  if (!date) return ERR;
  try {
    return { ok: true, value: (tz ? date.tz(tz) : date.utc()).format(pattern) };
  } catch {
    return { ok: false, error: `Unknown timezone: ${tz}` };
  }
}

export function convertTimezone(input: string, tz: string): ToolResult {
  const date = parse(input);
  if (!date) return ERR;
  try {
    return { ok: true, value: date.tz(tz).format("YYYY-MM-DD HH:mm:ss") };
  } catch {
    return { ok: false, error: `Unknown timezone: ${tz}` };
  }
}

export function relativeFrom(input: string, baseMs: number): ToolResult {
  const date = parse(input);
  return date ? { ok: true, value: date.from(dayjs(baseMs)) } : ERR;
}
