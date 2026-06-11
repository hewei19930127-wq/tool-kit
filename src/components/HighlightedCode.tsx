import { Fragment, useMemo } from "react";
import { SearchMark } from "@/components/SearchMark";
import { type Language, type TokenType, tokenize } from "@/core/services/highlight";
import { overlayMatches, type SearchHighlight } from "@/core/services/search";

const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "",
  key: "text-syntax-key",
  string: "text-syntax-string",
  number: "text-syntax-number",
  boolean: "text-syntax-boolean",
  null: "text-syntax-null",
  punctuation: "text-syntax-punctuation",
  tag: "text-syntax-tag",
  attr: "text-syntax-attr",
  comment: "text-syntax-comment italic",
  meta: "text-syntax-meta",
};

export function HighlightedCode({
  code,
  language,
  label,
  search,
}: {
  code: string;
  language: Language;
  label: string;
  /** Find-in-output matches over `code`, rendered as <mark> runs. */
  search?: SearchHighlight;
}) {
  const tokens = useMemo(() => tokenize(code, language), [code, language]);
  // Tokens concatenate back to `code` exactly, so match offsets line up.
  const runs = useMemo(
    () =>
      overlayMatches(
        tokens.map((token) => ({ text: token.text, meta: token.type })),
        search?.matches ?? [],
      ),
    [tokens, search?.matches],
  );

  return (
    <pre
      role="region"
      aria-label={label}
      className="whitespace-pre-wrap break-words font-mono text-sm leading-5"
    >
      {runs.map((run) => {
        // Run starts are unique offsets into the source — stable React keys.
        const text =
          run.match == null ? (
            run.text
          ) : (
            <SearchMark key={run.start} active={run.match === search?.activeIndex}>
              {run.text}
            </SearchMark>
          );
        return run.meta === "plain" ? (
          <Fragment key={run.start}>{text}</Fragment>
        ) : (
          <span key={run.start} className={TOKEN_CLASS[run.meta]}>
            {text}
          </span>
        );
      })}
    </pre>
  );
}
