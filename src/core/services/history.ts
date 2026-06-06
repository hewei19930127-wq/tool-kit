export interface HistoryEntry {
  input: string;
  output: string;
  ts: number;
}

export function pushHistory(list: HistoryEntry[], entry: HistoryEntry, cap = 20): HistoryEntry[] {
  const deduped = list.filter((item) => item.input !== entry.input);
  return [entry, ...deduped].slice(0, cap);
}
