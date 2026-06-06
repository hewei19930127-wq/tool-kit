import type { ToolResult } from "@/core/types";

export function OutputPane({
  result,
  emptyHint,
  label = "Output",
}: {
  result: ToolResult | null;
  emptyHint: string;
  label?: string;
}) {
  return (
    <div className="h-full min-h-64 overflow-auto rounded-md border border-border bg-muted p-3">
      {result?.ok && (
        <pre
          role="region"
          aria-label={label}
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
      {!result && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
    </div>
  );
}
