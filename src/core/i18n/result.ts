import type { ToolResult } from "@/core/types";
import type { TFunction } from "./types";

export function resultValue(result: ToolResult, t: TFunction): string {
  if (!result.ok) return "";
  return result.valueKey ? t(result.valueKey, result.params) : result.value;
}

export function resultError(result: ToolResult, t: TFunction): string {
  if (result.ok) return "";
  return result.errorKey ? t(result.errorKey, result.params) : result.error;
}
