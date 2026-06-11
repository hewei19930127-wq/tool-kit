import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect } from "react";
import type { OutputSearch } from "@/core/hooks/useOutputSearch";
import { useI18n } from "@/core/i18n";
import { SEARCH_MATCH_LIMIT } from "@/core/services/search";

const navButtonClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40";

/**
 * Floating find bar for `useOutputSearch`. Render it unconditionally inside a
 * `relative` container over the output; it mounts its UI only while open.
 */
export function SearchBar({ search }: { search: OutputSearch }) {
  const { t } = useI18n();
  const { open, query, matches, activeIndex, inputRef } = search;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, inputRef]);

  if (!open) return null;

  const total = matches.length;
  const totalLabel = total >= SEARCH_MATCH_LIMIT ? `${SEARCH_MATCH_LIMIT}+` : String(total);

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg border border-border bg-surface py-1 pr-1 pl-2 shadow-md">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        aria-label={t("components.search.label")}
        placeholder={t("components.search.placeholder")}
        onChange={(event) => search.setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) search.prev();
            else search.next();
          } else if (event.key === "Escape") {
            event.preventDefault();
            search.close();
          }
        }}
        className="w-36 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {query && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {total
            ? t("components.search.count", { current: activeIndex + 1, total: totalLabel })
            : t("components.search.noMatches")}
        </span>
      )}
      <button
        type="button"
        aria-label={t("components.search.prev")}
        onClick={search.prev}
        disabled={!total}
        className={navButtonClass}
      >
        <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={t("components.search.next")}
        onClick={search.next}
        disabled={!total}
        className={navButtonClass}
      >
        <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={t("components.search.close")}
        onClick={search.close}
        className={navButtonClass}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
