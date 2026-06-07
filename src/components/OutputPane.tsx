import { useI18n } from "@/core/i18n";
import { resultError, resultValue } from "@/core/i18n/result";
import type { ToolResult } from "@/core/types";

export function OutputPane({
  result,
  emptyHint,
  label,
}: {
  result: ToolResult | null;
  emptyHint: string;
  label?: string;
}) {
  const { t } = useI18n();
  const outputLabel = label ?? t("components.output.label");

  return (
    <div className="h-full min-h-64 overflow-auto rounded-md border border-border bg-muted p-3">
      {result?.ok && (
        <pre
          role="region"
          aria-label={outputLabel}
          className="whitespace-pre-wrap break-words font-mono text-sm leading-5"
        >
          {resultValue(result, t)}
        </pre>
      )}
      {result && !result.ok && (
        <div role="alert" className="font-mono text-sm text-error">
          {resultError(result, t)}
          {result.line != null && (
            <span>
              {" "}
              {t("components.output.lineCol", { line: result.line, col: result.col ?? "" })}
            </span>
          )}
        </div>
      )}
      {!result && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
    </div>
  );
}
