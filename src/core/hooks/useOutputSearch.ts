import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { findMatches, type SearchMatch } from "@/core/services/search";

export interface OutputSearch {
  open: boolean;
  query: string;
  matches: SearchMatch[];
  activeIndex: number;
  inputRef: RefObject<HTMLInputElement>;
  setQuery: (query: string) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
}

/**
 * Cmd/Ctrl+F find-in-output state for a tool. `text` is the searchable text of
 * the currently rendered output; matches clear while the bar is closed so
 * highlights never linger. Render the returned object with `SearchBar` and pass
 * it as the `search` highlight to the output renderer.
 */
export function useOutputSearch(text: string): OutputSearch {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => (open ? findMatches(text, query) : []), [open, text, query]);
  const activeIndex = matches.length ? Math.min(cursor, matches.length - 1) : 0;

  // Restart from the first match whenever the query or the output changes
  // (state adjusted during render instead of an effect, per the React docs).
  const [previous, setPrevious] = useState({ text, query });
  if (previous.text !== text || previous.query !== query) {
    setPrevious({ text, query });
    setCursor(0);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      setOpen(true);
      // Already open: re-select for a fresh query. The first open is covered by
      // SearchBar's focus-on-open effect, before the input exists.
      inputRef.current?.select();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the active match visible. The diff split view has no <mark> elements
  // (CodeMirror decorations scroll via the editor instead), so this no-ops there.
  useEffect(() => {
    if (!open || !matches[activeIndex]) return;
    const mark = document.querySelector("mark[data-search-active]");
    if (mark && typeof mark.scrollIntoView === "function") {
      mark.scrollIntoView({ block: "center" });
    }
  }, [open, matches, activeIndex]);

  return {
    open,
    query,
    matches,
    activeIndex,
    inputRef,
    setQuery,
    next: () => {
      if (matches.length) setCursor((activeIndex + 1) % matches.length);
    },
    prev: () => {
      if (matches.length) setCursor((activeIndex - 1 + matches.length) % matches.length);
    },
    close: () => setOpen(false),
  };
}
