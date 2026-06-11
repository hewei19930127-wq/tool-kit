import { MergeView } from "@codemirror/merge";
import { EditorState, type Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { SearchMark } from "@/components/SearchMark";
import { useOutputSearch } from "@/core/hooks/useOutputSearch";
import { type I18nKey, useI18n } from "@/core/i18n";
import { overlayMatches, type SearchMatch } from "@/core/services/search";
import { type DiffView, useAppStore } from "@/core/store";
import { DiffTabs } from "./DiffTabs";
import { computeDiff, type DiffMode, diffStats } from "./diff";

const MODE_LABEL_KEYS: Record<DiffMode, I18nKey> = {
  line: "tools.diff.mode.line",
  word: "tools.diff.mode.word",
  char: "tools.diff.mode.char",
};
const VIEW_LABEL_KEYS: Record<DiffView, I18nKey> = {
  inline: "tools.diff.view.inline",
  split: "tools.diff.view.split",
};

/** Find-in-output highlights for one split-view editor, styled like SearchMark. */
function searchDecorations(matches: SearchMatch[], activeStart: number | null): Extension {
  const builder = new RangeSetBuilder<Decoration>();
  for (const match of matches) {
    builder.add(
      match.start,
      match.end,
      Decoration.mark({
        class:
          match.start === activeStart
            ? "tk-search-match tk-search-match-active"
            : "tk-search-match",
      }),
    );
  }
  return EditorView.decorations.of(builder.finish());
}

export default function DiffTool() {
  const { t } = useI18n();
  const active = useAppStore(
    (state) =>
      state.diff.tabs.find((tab) => tab.id === state.diff.activeTabId) ?? state.diff.tabs[0],
  );
  const mode = useAppStore((state) => state.diff.mode);
  const view = useAppStore((state) => state.diff.view);
  const setDiffTabSide = useAppStore((state) => state.setDiffTabSide);
  const setDiffMode = useAppStore((state) => state.setDiffMode);
  const setDiffView = useAppStore((state) => state.setDiffView);

  // Diff-only hotkeys: this listener mounts only while the Diff tool is open, so
  // it never affects other tools. Cmd/Ctrl+T opens a new tab; Cmd/Ctrl+1-9 switch
  // tabs; Cmd/Ctrl+Shift+[ / ] cycle to the previous/next tab (wrapping);
  // Cmd/Ctrl+W closes the active tab (the store keeps the last tab open).
  // Cmd/Ctrl+K is intentionally left to the global command palette.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const store = useAppStore.getState();
      // event.code rather than event.key: with Shift held, key reports "{" / "}"
      // on US layouts and other characters elsewhere.
      if (event.shiftKey && (event.code === "BracketLeft" || event.code === "BracketRight")) {
        const { tabs, activeTabId } = store.diff;
        const index = tabs.findIndex((tab) => tab.id === activeTabId);
        if (index === -1) return;
        event.preventDefault();
        const delta = event.code === "BracketLeft" ? -1 : 1;
        store.setActiveDiffTab(tabs[(index + delta + tabs.length) % tabs.length].id);
        return;
      }
      if (event.key === "t") {
        event.preventDefault();
        store.addDiffTab();
        return;
      }
      if (event.key === "w") {
        // Only claim the shortcut when a close will actually happen, mirroring
        // the close button that is hidden on the last remaining tab.
        if (store.diff.tabs.length > 1) {
          event.preventDefault();
          store.closeDiffTab(store.diff.activeTabId);
        }
        return;
      }
      if (event.key.length === 1 && event.key >= "1" && event.key <= "9") {
        const tab = store.diff.tabs[Number(event.key) - 1];
        if (tab) {
          event.preventDefault();
          store.setActiveDiffTab(tab.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const parts = useMemo(() => computeDiff(active.a, active.b, mode), [active.a, active.b, mode]);
  const stats = useMemo(() => diffStats(parts), [parts]);

  // The searchable text mirrors what each view renders: the concatenated diff
  // runs inline, or both documents in split view (NUL-separated so a query can
  // never match across the A/B boundary).
  const searchText = useMemo(
    () =>
      view === "inline" ? parts.map((part) => part.value).join("") : `${active.a}\u0000${active.b}`,
    [view, parts, active.a, active.b],
  );
  const search = useOutputSearch(searchText);

  const inlineRuns = useMemo(
    () =>
      overlayMatches(
        parts.map((part) => ({ text: part.value, meta: part })),
        view === "inline" ? search.matches : [],
      ),
    [parts, view, search.matches],
  );

  const mergeHost = useRef<HTMLDivElement>(null);
  const { matches, activeIndex } = search;
  useEffect(() => {
    if (view !== "split" || !mergeHost.current) return;

    // Map matches over `a\0b` back onto the two documents. A match overlapping
    // the separator can only happen for queries containing NUL; drop it.
    const aLength = active.a.length;
    const aMatches: SearchMatch[] = [];
    const bMatches: SearchMatch[] = [];
    for (const match of matches) {
      if (match.end <= aLength) aMatches.push(match);
      else if (match.start > aLength) {
        bMatches.push({ start: match.start - aLength - 1, end: match.end - aLength - 1 });
      }
    }
    const activeMatch = matches[activeIndex] ?? null;
    const activeInA = activeMatch != null && activeMatch.end <= aLength;
    const activeInB = activeMatch != null && activeMatch.start > aLength;

    const mergeView = new MergeView({
      parent: mergeHost.current,
      a: {
        doc: active.a,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          searchDecorations(aMatches, activeInA ? activeMatch.start : null),
        ],
      },
      b: {
        doc: active.b,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          searchDecorations(bMatches, activeInB ? activeMatch.start - aLength - 1 : null),
        ],
      },
    });
    if (activeInA || activeInB) {
      const editor = activeInA ? mergeView.a : mergeView.b;
      const pos = activeInA ? activeMatch.start : activeMatch.start - aLength - 1;
      editor.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
    }
    return () => mergeView.destroy();
  }, [view, active.a, active.b, matches, activeIndex]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <DiffTabs />

      <div className="flex flex-wrap items-center gap-2">
        {(["line", "word", "char"] as DiffMode[]).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setDiffMode(nextMode)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === nextMode
                ? "border border-primary/45 bg-primary/10 font-medium text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(MODE_LABEL_KEYS[nextMode])}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        {(["inline", "split"] as DiffView[]).map((nextView) => (
          <button
            key={nextView}
            type="button"
            onClick={() => setDiffView(nextView)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              view === nextView
                ? "border border-primary/45 bg-primary/10 font-medium text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(VIEW_LABEL_KEYS[nextView])}
          </button>
        ))}
        <span aria-label={t("tools.diff.stats")} className="ml-auto font-mono text-sm">
          <span className="text-success">+{stats.added}</span>{" "}
          <span className="text-error">-{stats.removed}</span>
        </span>
      </div>

      <div className="grid h-40 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label={t("tools.diff.original")}
          value={active.a}
          onChange={(event) => setDiffTabSide(active.id, "a", event.target.value)}
          placeholder={t("tools.diff.placeholder.original")}
          className="h-full resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <textarea
          aria-label={t("tools.diff.changed")}
          value={active.b}
          onChange={(event) => setDiffTabSide(active.id, "b", event.target.value)}
          placeholder={t("tools.diff.placeholder.changed")}
          className="h-full resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {view === "inline" ? (
          <pre
            role="region"
            aria-label={t("tools.diff.inline")}
            className="h-full overflow-auto rounded-md border border-border bg-muted p-3 whitespace-pre-wrap font-mono text-sm leading-5"
          >
            {inlineRuns.map((run) => {
              const text =
                run.match == null ? (
                  run.text
                ) : (
                  <SearchMark key={run.start} active={run.match === search.activeIndex}>
                    {run.text}
                  </SearchMark>
                );
              return run.meta.added ? (
                <ins key={run.start} className="bg-success/20 text-success no-underline">
                  {text}
                </ins>
              ) : run.meta.removed ? (
                <del key={run.start} className="bg-error/20 text-error">
                  {text}
                </del>
              ) : (
                <span key={run.start}>{text}</span>
              );
            })}
          </pre>
        ) : (
          <div
            ref={mergeHost}
            role="region"
            aria-label={t("tools.diff.split")}
            className="h-full overflow-auto"
          />
        )}
        <SearchBar search={search} />
      </div>
    </div>
  );
}
