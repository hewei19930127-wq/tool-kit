import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useTransform } from "@/core/hooks/useTransform";
import type { ToolResult } from "@/core/types";
import { validateXml } from "./xml";

type Action =
  | { label: string; op: string }
  | { label: string; run: (input: string) => ToolResult };

const ACTIONS: Action[] = [
  { label: "Format", op: "xml.format" },
  { label: "Minify", op: "xml.minify" },
  { label: "Validate", run: validateXml },
];

export default function XmlTool() {
  const [input, setInput] = useToolInput("xml");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("xml");
  const { run, pending } = useTransform();

  async function apply(action: Action) {
    const next =
      "op" in action ? await run(action.op, input) : action.run(input);
    setResult(next);
    if (next.ok) record(input, next.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void apply(action)}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
        {pending && (
          <span className="text-xs text-muted-foreground">Working...</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton text={result?.ok ? result.value : ""} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label="XML input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste XML here, e.g. <root><item/></root>"
          className="h-full min-h-64 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <OutputPane
          result={result}
          emptyHint="Output appears here. Paste XML and pick an action."
        />
      </div>
    </div>
  );
}
