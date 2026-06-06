import { useEffect, useState } from "react";
import { useHistory } from "@/core/hooks/useHistory";
import type { ToolResult } from "@/core/types";
import {
  escapeJson,
  formatJson,
  minifyJson,
  sortJsonKeys,
  unescapeJson,
  validateJson,
} from "./json";

type Action = (input: string) => ToolResult;

const ACTIONS: { label: string; run: Action }[] = [
  { label: "Format", run: (input) => formatJson(input) },
  { label: "Minify", run: (input) => minifyJson(input) },
  { label: "Validate", run: (input) => validateJson(input) },
  { label: "Sort keys", run: (input) => sortJsonKeys(input) },
  { label: "Escape", run: (input) => escapeJson(input) },
  { label: "Unescape", run: (input) => unescapeJson(input) },
];

export default function JsonTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { record } = useHistory("json");

  useEffect(() => {
    const onFill = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text === "string") setInput(text);
    };
    window.addEventListener("toolkit:fill-active-input", onFill);
    return () => window.removeEventListener("toolkit:fill-active-input", onFill);
  }, []);

  function apply(run: Action) {
    const next = run(input);
    setResult(next);
    if (next.ok) record(input, next.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => apply(action.run)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label="JSON input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder='Paste JSON here, e.g. {"hello": "world"}'
          className="h-full min-h-64 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="h-full min-h-64 overflow-auto rounded-md border border-border bg-muted p-3">
          {result?.ok && (
            <pre
              aria-label="Output"
              className="whitespace-pre-wrap break-words font-mono text-sm leading-5"
            >
              {result.value}
            </pre>
          )}
          {result && !result.ok && (
            <div role="alert" className="font-mono text-sm text-error">
              {result.error}
              {result.line != null && (
                <span>
                  {" "}
                  (line {result.line}, col {result.col})
                </span>
              )}
            </div>
          )}
          {!result && (
            <p className="text-sm text-muted-foreground">
              Output appears here. Paste JSON and pick an action.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
