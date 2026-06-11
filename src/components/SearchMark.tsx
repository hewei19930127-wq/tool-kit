import type { ReactNode } from "react";

/**
 * Highlight wrapper for find-in-output matches rendered as DOM text. The
 * `tk-search-match` classes (in `index.css`) are shared with the CodeMirror
 * decorations in the diff split view; `data-search-active` is what
 * `useOutputSearch` scrolls into view.
 */
export function SearchMark({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <mark
      data-search-active={active ? "" : undefined}
      className={active ? "tk-search-match tk-search-match-active" : "tk-search-match"}
    >
      {children}
    </mark>
  );
}
