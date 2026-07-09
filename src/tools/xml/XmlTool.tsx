import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { SearchBar } from "@/components/SearchBar";
import { WrapToggle } from "@/components/WrapToggle";
import { useHistory } from "@/core/hooks/useHistory";
import { useOutputSearch } from "@/core/hooks/useOutputSearch";
import { useTransform } from "@/core/hooks/useTransform";
import { type I18nKey, useI18n } from "@/core/i18n";
import { resultValue } from "@/core/i18n/result";
import { useAppStore } from "@/core/store";
import type { ToolResult } from "@/core/types";
import { TextTabs } from "@/tools/shared/TextTabs";
import { validateXml } from "./xml";

type Action =
  | { labelKey: I18nKey; op: string }
  | { labelKey: I18nKey; run: (input: string) => ToolResult };

const ACTIONS: Action[] = [
  { labelKey: "tools.xml.actions.format", op: "xml.format" },
  { labelKey: "tools.xml.actions.minify", op: "xml.minify" },
  { labelKey: "tools.xml.actions.validate", run: validateXml },
];

export default function XmlTool() {
  const { t } = useI18n();
  const active = useAppStore((state) => {
    const slice = state.textTabs.xml;
    return (
      slice.tabs.find((tab) => tab.id === slice.activeTabId) ??
      slice.tabs[0] ?? { id: "xml-fallback", seq: 1, input: "" }
    );
  });
  const setTextTabInput = useAppStore((state) => state.setTextTabInput);
  const [results, setResults] = useState<Record<string, ToolResult | null>>({});
  const result = results[active.id] ?? null;
  const { entries, record } = useHistory("xml");
  const { run, pending } = useTransform();
  const copyText = result?.ok ? resultValue(result, t) : "";
  const search = useOutputSearch(copyText);
  const wrap = useAppStore((state) => state.wrap);
  const setInput = (text: string) => setTextTabInput("xml", active.id, text);

  async function apply(action: Action) {
    const tabId = active.id;
    const input = active.input;
    const next = "op" in action ? await run(action.op, input) : action.run(input);
    setResults((current) => ({ ...current, [tabId]: next }));
    if (next.ok) record(input, next.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <TextTabs toolId="xml" />

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
        {pending && <span className="text-xs text-muted-foreground">{t("tools.xml.working")}</span>}
        <div className="ml-auto flex items-center gap-2">
          <WrapToggle />
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton text={copyText} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label={t("tools.xml.input")}
          value={active.input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.xml.placeholder")}
          className="h-full min-h-64 resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <div className="relative min-h-64">
          <OutputPane
            result={result}
            emptyHint={t("tools.xml.empty")}
            language="xml"
            search={search}
            wrap={wrap}
          />
          <SearchBar search={search} />
        </div>
      </div>
    </div>
  );
}
