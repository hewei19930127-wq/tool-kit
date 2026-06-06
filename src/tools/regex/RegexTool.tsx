import { useMemo, useState, type ReactNode } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { runRegex, type RegexMatch } from "./regex";
import { CHEATSHEET, SNIPPETS } from "./snippets";

function Highlighted({
  text,
  matches,
}: {
  text: string;
  matches: RegexMatch[];
}) {
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
            aria-label="Pattern"
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="pattern"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span className="font-mono text-muted-foreground">/</span>
          <input
            aria-label="Flags"
            value={flags}
            onChange={(event) => setFlags(event.target.value)}
            className="w-20 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span
            aria-label="Match count"
            className="min-w-24 text-sm text-muted-foreground"
          >
            {result?.ok ? `${matches.length} matches` : ""}
          </span>
        </div>

        {result && !result.ok && (
          <div role="alert" className="font-mono text-sm text-error">
            {result.error}
          </div>
        )}

        <textarea
          aria-label="Sample text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Sample text to test against"
          className="h-28 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  <th className="px-3 py-1.5">Match</th>
                  <th className="px-3 py-1.5">Groups</th>
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
            Snippets
          </div>
          {SNIPPETS.map((snippet) => (
            <button
              key={snippet.name}
              type="button"
              onClick={() => {
                setPattern(snippet.pattern);
                setFlags(snippet.flags);
              }}
              title={snippet.description}
              className="block w-full truncate rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              {snippet.name}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">
            Cheatsheet
          </div>
          {CHEATSHEET.map((item) => (
            <div key={item.token} className="flex gap-2 px-2 py-1 text-xs">
              <code className="shrink-0 font-mono text-primary">
                {item.token}
              </code>
              <span className="text-muted-foreground">{item.meaning}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
