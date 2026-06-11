/**
 * Plain-text find-in-output, shared by the JSON/XML output panes and the Diff
 * result views. Pure functions in the spirit of the tool transforms: they never
 * throw, and the concatenation of every run's `text` from `overlayMatches`
 * always reproduces the input exactly.
 */

export interface SearchMatch {
  start: number;
  end: number;
}

/** What highlight consumers need to render matches: see `useOutputSearch`. */
export interface SearchHighlight {
  matches: SearchMatch[];
  activeIndex: number;
}

/** Caps match collection so highlight rendering stays bounded on huge outputs. */
export const SEARCH_MATCH_LIMIT = 1000;

/**
 * Case-insensitive, non-overlapping matches of `query` in `text`. Falls back to
 * case-sensitive matching when lowercasing changes a string's length (e.g. "İ"),
 * which would desynchronize the reported offsets.
 */
export function findMatches(
  text: string,
  query: string,
  limit = SEARCH_MATCH_LIMIT,
): SearchMatch[] {
  if (!query) return [];
  let haystack = text.toLowerCase();
  let needle = query.toLowerCase();
  if (haystack.length !== text.length || needle.length !== query.length) {
    haystack = text;
    needle = query;
  }

  const matches: SearchMatch[] = [];
  let from = 0;
  while (matches.length < limit) {
    const start = haystack.indexOf(needle, from);
    if (start === -1) break;
    const end = start + needle.length;
    matches.push({ start, end });
    from = end;
  }
  return matches;
}

export interface MatchedRun<T> {
  text: string;
  meta: T;
  /** Absolute offset of this run in the searched string. */
  start: number;
  /** Index into the matches array, or null for unmatched text. */
  match: number | null;
}

/**
 * Overlay sorted matches onto a sequence of text chunks whose concatenation is
 * the searched string. Chunks are split where match boundaries fall inside
 * them; a match spanning several chunks yields one run per chunk, all carrying
 * the same match index. Empty chunks produce no runs.
 */
export function overlayMatches<T>(
  chunks: ReadonlyArray<{ text: string; meta: T }>,
  matches: readonly SearchMatch[],
): MatchedRun<T>[] {
  const runs: MatchedRun<T>[] = [];
  let pos = 0;
  let mi = 0;

  for (const chunk of chunks) {
    const end = pos + chunk.text.length;
    let cursor = pos;
    while (mi < matches.length && cursor < end) {
      const match = matches[mi];
      if (match.end <= cursor) {
        mi++;
        continue;
      }
      if (match.start >= end) break;
      const from = Math.max(match.start, cursor);
      if (from > cursor) {
        runs.push({
          text: chunk.text.slice(cursor - pos, from - pos),
          meta: chunk.meta,
          start: cursor,
          match: null,
        });
      }
      const to = Math.min(match.end, end);
      runs.push({
        text: chunk.text.slice(from - pos, to - pos),
        meta: chunk.meta,
        start: from,
        match: mi,
      });
      cursor = to;
      if (match.end <= end) mi++;
      else break; // The match continues into the next chunk.
    }
    if (cursor < end) {
      runs.push({
        text: chunk.text.slice(cursor - pos),
        meta: chunk.meta,
        start: cursor,
        match: null,
      });
    }
    pos = end;
  }
  return runs;
}
