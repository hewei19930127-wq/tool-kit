import type { ToolResult } from "@/core/types";

export interface QueryParam {
  key: string;
  value: string;
}

export function encodeUrlComponent(input: string): ToolResult {
  try {
    return { ok: true, value: encodeURIComponent(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function decodeUrlComponent(input: string): ToolResult {
  try {
    return { ok: true, value: decodeURIComponent(input) };
  } catch {
    return { ok: false, error: "Malformed percent-encoding" };
  }
}

export function encodeUrlFull(input: string): ToolResult {
  try {
    return { ok: true, value: encodeURI(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function decodeUrlFull(input: string): ToolResult {
  try {
    return { ok: true, value: decodeURI(input) };
  } catch {
    return { ok: false, error: "Malformed percent-encoding" };
  }
}

export function parseQuery(input: string): ToolResult<QueryParam[]> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Input is empty" };

  try {
    let search = trimmed;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      search = new URL(trimmed).search;
    }
    if (search.startsWith("?")) search = search.slice(1);
    if (!search || (!search.includes("=") && !search.includes("&"))) {
      return { ok: true, value: [] };
    }

    const params = new URLSearchParams(search);
    const value: QueryParam[] = [];
    for (const [key, paramValue] of params) {
      value.push({ key, value: paramValue });
    }
    return { ok: true, value };
  } catch {
    return { ok: false, error: "Could not parse query parameters" };
  }
}
