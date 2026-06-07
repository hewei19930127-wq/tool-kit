import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useTransform } from "@/core/hooks/useTransform";
import { type I18nKey, useI18n } from "@/core/i18n";
import type { ToolResult } from "@/core/types";
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
  const [input, setInput] = useToolInput("xml");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("xml");
  const { run, pending } = useTransform();

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
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {t(action.labelKey)}
          </button>
        ))}
        {pending && <span className="text-xs text-muted-foreground">{t("tools.xml.working")}</span>}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton text={result?.ok ? result.value : ""} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label={t("tools.xml.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.xml.placeholder")}
          className="h-full min-h-64 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <OutputPane result={result} emptyHint={t("tools.xml.empty")} language="xml" />
      </div>
    </div>
  );
}
