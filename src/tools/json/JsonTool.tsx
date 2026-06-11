import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { SearchBar } from "@/components/SearchBar";
import { useHistory } from "@/core/hooks/useHistory";
import { useOutputSearch } from "@/core/hooks/useOutputSearch";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useTransform } from "@/core/hooks/useTransform";
import { type I18nKey, useI18n } from "@/core/i18n";
import { resultValue } from "@/core/i18n/result";
import type { ToolResult } from "@/core/types";
import { escapeJson, unescapeJson, validateJson } from "./json";

type Action =
  | { labelKey: I18nKey; op: string }
  | { labelKey: I18nKey; run: (input: string) => ToolResult };

const ACTIONS: Action[] = [
  { labelKey: "tools.json.actions.format", op: "json.format" },
  { labelKey: "tools.json.actions.minify", op: "json.minify" },
  { labelKey: "tools.json.actions.validate", run: validateJson },
  { labelKey: "tools.json.actions.sortKeys", op: "json.sortKeys" },
  { labelKey: "tools.json.actions.escape", run: escapeJson },
  { labelKey: "tools.json.actions.unescape", run: unescapeJson },
];

export default function JsonTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("json");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("json");
  const { run, pending } = useTransform();
  const copyText = result?.ok ? resultValue(result, t) : "";
  const search = useOutputSearch(copyText);

  async function apply(action: Action) {
    const next = "op" in action ? await run(action.op, input) : action.run(input);
    setResult(next);
    if (next.ok) record(input, next.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.labelKey}
            type="button"
            onClick={() => void apply(action)}
            disabled={pending}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {t(action.labelKey)}
          </button>
        ))}
        {pending && (
          <span className="text-xs text-muted-foreground">{t("tools.json.working")}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton text={copyText} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label={t("tools.json.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.json.placeholder")}
          className="h-full min-h-64 resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <div className="relative min-h-64">
          <OutputPane
            result={result}
            emptyHint={t("tools.json.empty")}
            language="json"
            search={search}
          />
          <SearchBar search={search} />
        </div>
      </div>
    </div>
  );
}
