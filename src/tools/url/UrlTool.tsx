import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import {
  decodeUrlComponent,
  decodeUrlFull,
  encodeUrlComponent,
  encodeUrlFull,
  parseQuery,
} from "./url";

type Op = "encode" | "decode";
type Scope = "component" | "full";

export default function UrlTool() {
  const [input, setInput] = useToolInput("url");
  const [op, setOp] = useState<Op>("encode");
  const [scope, setScope] = useState<Scope>("component");
  const { entries, record } = useHistory("url");

  const result = useMemo(() => {
    if (!input) return null;
    if (op === "encode") {
      return scope === "component" ? encodeUrlComponent(input) : encodeUrlFull(input);
    }
    return scope === "component" ? decodeUrlComponent(input) : decodeUrlFull(input);
  }, [input, op, scope]);

  const query = useMemo(() => parseQuery(input), [input]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["encode", "decode"] as Op[]).map((nextOp) => (
          <button
            key={nextOp}
            type="button"
            onClick={() => setOp(nextOp)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              op === nextOp
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {nextOp}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        {(["component", "full"] as Scope[]).map((nextScope) => (
          <button
            key={nextScope}
            type="button"
            onClick={() => setScope(nextScope)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              scope === nextScope
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted"
            }`}
          >
            {nextScope}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton
            text={result?.ok ? result.value : ""}
            onCopied={() => result?.ok && record(input, result.value)}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label="URL input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste a URL or text..."
          className="h-full min-h-64 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="flex min-h-0 flex-col gap-3">
          <OutputPane result={result} emptyHint="Encoded/decoded output appears here." />
          {query.ok && query.value.length > 0 && (
            <div className="overflow-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5">Key</th>
                    <th className="px-3 py-1.5">Value</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {query.value.map((param, index) => (
                    <tr key={`${param.key}:${index}`} className="border-t border-border">
                      <td className="px-3 py-1.5">{param.key}</td>
                      <td className="px-3 py-1.5">{param.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
