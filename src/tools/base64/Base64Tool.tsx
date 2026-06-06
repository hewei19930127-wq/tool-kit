import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { decodeBase64, encodeBase64 } from "./base64";

type Mode = "encode" | "decode";

export default function Base64Tool() {
  const [input, setInput] = useToolInput("base64");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const { entries, record } = useHistory("base64");

  const result = useMemo(() => {
    if (!input) return null;
    return mode === "encode"
      ? encodeBase64(input, urlSafe)
      : decodeBase64(input, urlSafe);
  }, [input, mode, urlSafe]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["encode", "decode"] as Mode[]).map((nextMode) => (
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
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={urlSafe}
            onChange={(event) => setUrlSafe(event.target.checked)}
          />
          URL-safe
        </label>
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
          aria-label="Base64 input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={mode === "encode" ? "Text to encode..." : "Base64 to decode..."}
          className="h-full min-h-64 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <OutputPane
          result={result}
          emptyHint="Type or paste on the left to convert."
        />
      </div>
    </div>
  );
}
