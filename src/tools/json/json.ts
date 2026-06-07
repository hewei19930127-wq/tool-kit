import { toMessage } from "@/core/result";
import type { ToolResult } from "@/core/types";

function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

function locate(message: string, input: string): { line?: number; col?: number } {
  const lineColumn = message.match(/line (\d+) column (\d+)/);
  if (lineColumn) {
    return { line: Number(lineColumn[1]), col: Number(lineColumn[2]) };
  }

  const position = message.match(/position (\d+)/);
  if (position) return offsetToLineCol(input, Number(position[1]));

  const unexpectedToken = message.match(/Unexpected token '([^']+)'/);
  if (unexpectedToken) {
    const offset = input.indexOf(unexpectedToken[1]);
    if (offset >= 0) return offsetToLineCol(input, offset);
  }

  const lastContentOffset = input.search(/\S\s*$/);
  if (lastContentOffset >= 0) return offsetToLineCol(input, lastContentOffset);

  return {};
}

function parse(input: string): ToolResult<unknown> {
  if (!input.trim()) {
    return { ok: false, error: "Input is empty", errorKey: "common.errors.inputEmpty" };
  }

  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    const message = toMessage(error);
    return { ok: false, error: message, ...locate(message, input) };
  }
}

export function formatJson(input: string, indent = 2): ToolResult {
  const result = parse(input);
  return result.ok ? { ok: true, value: JSON.stringify(result.value, null, indent) } : result;
}

export function minifyJson(input: string): ToolResult {
  const result = parse(input);
  return result.ok ? { ok: true, value: JSON.stringify(result.value) } : result;
}

export function validateJson(input: string): ToolResult {
  const result = parse(input);
  return result.ok
    ? { ok: true, value: "Valid JSON", valueKey: "tools.json.messages.valid" }
    : result;
}

export function escapeJson(input: string): ToolResult {
  return { ok: true, value: JSON.stringify(input) };
}

export function unescapeJson(input: string): ToolResult {
  const result = parse(input);
  if (!result.ok) return result;
  if (typeof result.value !== "string") {
    return {
      ok: false,
      error: "Input is not a JSON string literal",
      errorKey: "tools.json.errors.notStringLiteral",
    };
  }
  return { ok: true, value: result.value };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value;
}

export function sortJsonKeys(input: string, indent = 2): ToolResult {
  const result = parse(input);
  return result.ok
    ? { ok: true, value: JSON.stringify(sortValue(result.value), null, indent) }
    : result;
}
