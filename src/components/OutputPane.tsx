import { Fragment } from "react";
import { HighlightedCode } from "@/components/HighlightedCode";
import { SearchMark } from "@/components/SearchMark";
import { useI18n } from "@/core/i18n";
import { resultError, resultValue } from "@/core/i18n/result";
import type { Language } from "@/core/services/highlight";
import { overlayMatches, type SearchHighlight } from "@/core/services/search";
import type { ToolResult } from "@/core/types";

function PlainOutput({ text, search }: { text: string; search?: SearchHighlight }) {
  if (!search || search.matches.length === 0) return <>{text}</>;
  return (
    <>
      {overlayMatches([{ text, meta: null }], search.matches).map((run) =>
        run.match == null ? (
          <Fragment key={run.start}>{run.text}</Fragment>
        ) : (
          <SearchMark key={run.start} active={run.match === search.activeIndex}>
            {run.text}
          </SearchMark>
        ),
      )}
    </>
  );
}

export function OutputPane({
  result,
  emptyHint,
  label,
  language,
  search,
}: {
  result: ToolResult | null;
  emptyHint: string;
  label?: string;
  /** When set, render the output with syntax highlighting for this language. */
  language?: Language;
  /** Find-in-output matches over the rendered output text. */
  search?: SearchHighlight;
}) {
  const { t } = useI18n();
  const outputLabel = label ?? t("components.output.label");

  return (
    <div className="h-full min-h-64 overflow-auto rounded-lg border border-border bg-muted/60 p-3">
      {result?.ok &&
        // Localized status messages (e.g. "Valid JSON") carry a valueKey and
        // are not code, so they bypass syntax highlighting.
        (language && !result.valueKey ? (
          <HighlightedCode
            code={resultValue(result, t)}
            language={language}
            label={outputLabel}
            search={search}
          />
        ) : (
          <pre
            role="region"
            aria-label={outputLabel}
            className="whitespace-pre-wrap break-words font-mono text-sm leading-5"
          >
            <PlainOutput text={resultValue(result, t)} search={search} />
          </pre>
        ))}
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
