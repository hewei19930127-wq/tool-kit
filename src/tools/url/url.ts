import { toMessage } from "@/core/result";
import type { ToolResult } from "@/core/types";

export interface QueryParam {
  key: string;
  value: string;
}

function encodeWith(encode: (input: string) => string, input: string): ToolResult {
  try {
    return { ok: true, value: encode(input) };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

function decodeWith(decode: (input: string) => string, input: string): ToolResult {
  try {
    return { ok: true, value: decode(input) };
  } catch {
    return {
      ok: false,
      error: "Malformed percent-encoding",
      errorKey: "tools.url.errors.malformedPercent",
    };
  }
}

export function encodeUrlComponent(input: string): ToolResult {
  return encodeWith(encodeURIComponent, input);
}

export function decodeUrlComponent(input: string): ToolResult {
  return decodeWith(decodeURIComponent, input);
}

export function encodeUrlFull(input: string): ToolResult {
  return encodeWith(encodeURI, input);
}

export function decodeUrlFull(input: string): ToolResult {
  return decodeWith(decodeURI, input);
}

export function parseQuery(input: string): ToolResult<QueryParam[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Input is empty", errorKey: "common.errors.inputEmpty" };
  }

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
    return {
      ok: false,
      error: "Could not parse query parameters",
      errorKey: "tools.url.errors.parseQuery",
    };
  }
}
