import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef } from "react";
import { type I18nKey, useI18n } from "@/core/i18n";
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
  // tabs. Cmd/Ctrl+K is intentionally left to the global command palette.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const store = useAppStore.getState();
      if (event.key === "t") {
        event.preventDefault();
        store.addDiffTab();
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

  const mergeHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view !== "split" || !mergeHost.current) return;

    const mergeView = new MergeView({
      parent: mergeHost.current,
      a: {
        doc: active.a,
        extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
      },
      b: {
        doc: active.b,
        extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
      },
    });
    return () => mergeView.destroy();
  }, [view, active.a, active.b]);

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
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
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
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted"
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
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <textarea
          aria-label={t("tools.diff.changed")}
          value={active.b}
          onChange={(event) => setDiffTabSide(active.id, "b", event.target.value)}
          placeholder={t("tools.diff.placeholder.changed")}
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {view === "inline" ? (
        <pre
          role="region"
          aria-label={t("tools.diff.inline")}
          className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 whitespace-pre-wrap font-mono text-sm leading-5"
        >
          {parts.map((part, index) =>
            part.added ? (
              <ins key={index} className="bg-success/20 text-success no-underline">
                {part.value}
              </ins>
            ) : part.removed ? (
              <del key={index} className="bg-error/20 text-error">
                {part.value}
              </del>
            ) : (
              <span key={index}>{part.value}</span>
            ),
          )}
        </pre>
      ) : (
        <div
          ref={mergeHost}
          role="region"
          aria-label={t("tools.diff.split")}
          className="min-h-0 flex-1 overflow-auto rounded-md border border-border"
        />
      )}
    </div>
  );
}
