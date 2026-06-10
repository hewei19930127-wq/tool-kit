import { type ReactNode, useMemo, useState } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useI18n } from "@/core/i18n";
import { resultError } from "@/core/i18n/result";
import { type RegexMatch, runRegex } from "./regex";
import { CHEATSHEET, SNIPPETS } from "./snippets";

function Highlighted({ text, matches }: { text: string; matches: RegexMatch[] }) {
  if (matches.length === 0) return <>{text}</>;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.index > cursor) {
      nodes.push(<span key={`t${index}`}>{text.slice(cursor, match.index)}</span>);
    }

    nodes.push(
      <mark key={`m${index}`} className="rounded bg-primary/20 text-foreground">
        {match.match}
      </mark>,
    );
    cursor = match.index + match.match.length;
  });

  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);

  return <>{nodes}</>;
}

export default function RegexTool() {
  const { t } = useI18n();
  const [text, setText] = useToolInput("regex");
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");

  const result = useMemo(
    () => (pattern ? runRegex(pattern, flags, text) : null),
    [flags, pattern, text],
  );
  const matches = result?.ok ? result.value : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-muted-foreground">/</span>
          <input
            aria-label={t("tools.regex.pattern")}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder={t("tools.regex.patternPlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <span className="font-mono text-muted-foreground">/</span>
          <input
            aria-label={t("tools.regex.flags")}
            value={flags}
            onChange={(event) => setFlags(event.target.value)}
            className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <span
            aria-label={t("tools.regex.matchCount")}
            className="min-w-24 text-sm text-muted-foreground"
          >
            {result?.ok ? t("tools.regex.matches", { count: matches.length }) : ""}
          </span>
        </div>

        {result && !result.ok && (
          <div role="alert" className="font-mono text-sm text-error">
            {resultError(result, t)}
          </div>
        )}

        <textarea
          aria-label={t("tools.regex.sampleText")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("tools.regex.samplePlaceholder")}
          className="h-28 resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />

        <div className="min-h-32 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-sm whitespace-pre-wrap">
          <Highlighted text={text} matches={matches} />
        </div>

        {matches.some((match) => match.groups.length > 0) && (
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">{t("tools.regex.table.match")}</th>
                  <th className="px-3 py-1.5">{t("tools.regex.table.groups")}</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {matches.map((match, index) => (
                  <tr key={`${match.index}-${index}`} className="border-t border-border">
                    <td className="px-3 py-1.5">{index + 1}</td>
                    <td className="px-3 py-1.5">{match.match}</td>
                    <td className="px-3 py-1.5">{match.groups.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="flex max-h-full w-full shrink-0 flex-col gap-3 overflow-auto lg:w-64">
        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">
            {t("tools.regex.snippets")}
          </div>
          {SNIPPETS.map((snippet) => (
            <button
              key={snippet.nameKey}
              type="button"
              onClick={() => {
                setPattern(snippet.pattern);
                setFlags(snippet.flags);
              }}
              title={t(snippet.descriptionKey)}
              className="block w-full truncate rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t(snippet.nameKey)}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">
            {t("tools.regex.cheatsheet")}
          </div>
          {CHEATSHEET.map((item) => (
            <div key={item.token} className="flex gap-2 px-2 py-1 text-xs">
              <code className="shrink-0 font-mono text-primary">{item.token}</code>
              <span className="text-muted-foreground">{t(item.meaningKey)}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
