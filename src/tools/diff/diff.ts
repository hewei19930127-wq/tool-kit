import { type Change, diffChars, diffLines, diffWords } from "diff";

export type DiffMode = "line" | "word" | "char";

export interface DiffPart {
  value: string;
  added: boolean;
  removed: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export function computeDiff(a: string, b: string, mode: DiffMode): DiffPart[] {
  let changes: Change[];
  if (mode === "line") changes = diffLines(a, b);
  else if (mode === "word") changes = diffWords(a, b);
  else changes = diffChars(a, b);

  return changes.map((change) => ({
    value: change.value,
    added: Boolean(change.added),
    removed: Boolean(change.removed),
  }));
}

export function diffStats(parts: DiffPart[]): DiffStats {
  return parts.reduce<DiffStats>(
    (stats, part) => {
      if (part.added) stats.added += 1;
      else if (part.removed) stats.removed += 1;
      return stats;
    },
    { added: 0, removed: 0 },
  );
}
