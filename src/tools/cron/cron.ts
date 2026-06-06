import parser from "cron-parser";
import cronstrue from "cronstrue";
import type { ToolResult } from "@/core/types";

export function describeCron(expr: string): ToolResult {
  const input = expr.trim();
  if (!input) return { ok: false, error: "Input is empty" };

  try {
    return {
      ok: true,
      value: cronstrue.toString(input, { throwExceptionOnParseError: true }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function nextRuns(
  expr: string,
  count: number,
  fromMs?: number,
  tz = "UTC",
): ToolResult<string[]> {
  const input = expr.trim();
  if (!input) return { ok: false, error: "Input is empty" };

  try {
    const options: { currentDate?: Date; tz?: string } = { tz };
    if (fromMs != null) options.currentDate = new Date(fromMs);

    const interval = parser.parseExpression(input, options);
    const value: string[] = [];

    for (let i = 0; i < count; i += 1) {
      value.push(interval.next().toDate().toISOString());
    }

    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
