import { useMemo } from "react";
import { type Language, type TokenType, tokenize } from "@/core/services/highlight";

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
}: {
  code: string;
  language: Language;
  label: string;
}) {
  const tokens = useMemo(() => tokenize(code, language), [code, language]);

  return (
    <pre
      role="region"
      aria-label={label}
      className="whitespace-pre-wrap break-words font-mono text-sm leading-5"
    >
      {tokens.map((token) =>
        token.type === "plain" ? (
          token.text
        ) : (
          <span key={token.start} className={TOKEN_CLASS[token.type]}>
            {token.text}
          </span>
        ),
      )}
    </pre>
  );
}
