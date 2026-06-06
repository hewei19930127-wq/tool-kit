import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { computeDiff, type DiffMode, diffStats } from "./diff";

type View = "inline" | "split";

export default function DiffTool() {
  const [a, setA] = useToolInput("diff:a");
  const [b, setB] = useToolInput("diff");
  const [mode, setMode] = useState<DiffMode>("line");
  const [view, setView] = useState<View>("inline");

  const parts = useMemo(() => computeDiff(a, b, mode), [a, b, mode]);
  const stats = useMemo(() => diffStats(parts), [parts]);

  const mergeHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view !== "split" || !mergeHost.current) return;

    const mergeView = new MergeView({
      parent: mergeHost.current,
      a: {
        doc: a,
        extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
      },
      b: {
        doc: b,
        extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
      },
    });
    return () => mergeView.destroy();
  }, [view, a, b]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["line", "word", "char"] as DiffMode[]).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setMode(nextMode)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === nextMode
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {nextMode}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        {(["inline", "split"] as View[]).map((nextView) => (
          <button
            key={nextView}
            type="button"
            onClick={() => setView(nextView)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              view === nextView
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted"
            }`}
          >
            {nextView}
          </button>
        ))}
        <span aria-label="Diff stats" className="ml-auto font-mono text-sm">
          <span className="text-success">+{stats.added}</span>{" "}
          <span className="text-error">-{stats.removed}</span>
        </span>
      </div>

      <div className="grid h-40 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label="Original (A)"
          value={a}
          onChange={(event) => setA(event.target.value)}
          placeholder="Original..."
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <textarea
          aria-label="Changed (B)"
          value={b}
          onChange={(event) => setB(event.target.value)}
          placeholder="Changed..."
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {view === "inline" ? (
        <pre
          role="region"
          aria-label="Inline diff"
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
          className="min-h-0 flex-1 overflow-auto rounded-md border border-border"
        />
      )}
    </div>
  );
}
