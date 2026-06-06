import { toMessage } from "@/core/result";
import type { ToolResult } from "@/core/types";

export interface RegexMatch {
  index: number;
  match: string;
  groups: string[];
}

export function runRegex(
  pattern: string,
  flags: string,
  text: string,
): ToolResult<RegexMatch[]> {
  let regex: RegExp;

  try {
    regex = new RegExp(pattern, flags);
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }

  const matches: RegexMatch[] = [];

  if (regex.global) {
    let match: RegExpExecArray | null;
    let guard = 0;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        match: match[0],
        groups: match.slice(1).map((group) => group ?? ""),
      });

      if (match.index === regex.lastIndex) regex.lastIndex += 1;
      if ((guard += 1) > 100_000) break;
    }
  } else {
    const match = regex.exec(text);
    if (match) {
      matches.push({
        index: match.index,
        match: match[0],
        groups: match.slice(1).map((group) => group ?? ""),
      });
    }
  }

  return { ok: true, value: matches };
}
