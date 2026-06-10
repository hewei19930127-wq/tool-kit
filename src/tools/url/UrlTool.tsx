import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { type I18nKey, useI18n } from "@/core/i18n";
import {
  decodeUrlComponent,
  decodeUrlFull,
  encodeUrlComponent,
  encodeUrlFull,
  parseQuery,
} from "./url";

type Op = "encode" | "decode";
type Scope = "component" | "full";
const OP_LABEL_KEYS: Record<Op, I18nKey> = {
  encode: "tools.url.actions.encode",
  decode: "tools.url.actions.decode",
};
const SCOPE_LABEL_KEYS: Record<Scope, I18nKey> = {
  component: "tools.url.scope.component",
  full: "tools.url.scope.full",
};

export default function UrlTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("url");
  const [op, setOp] = useState<Op>("encode");
  const [scope, setScope] = useState<Scope>("component");
  const { entries, record } = useHistory("url");

  const result = useMemo(() => {
    if (!input) return null;
    if (op === "encode") {
      return scope === "component" ? encodeUrlComponent(input) : encodeUrlFull(input);
    }
    return scope === "component" ? decodeUrlComponent(input) : decodeUrlFull(input);
  }, [input, op, scope]);

  const query = useMemo(() => parseQuery(input), [input]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["encode", "decode"] as Op[]).map((nextOp) => (
          <button
            key={nextOp}
            type="button"
            onClick={() => setOp(nextOp)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              op === nextOp
                ? "border border-primary/45 bg-primary/10 font-medium text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(OP_LABEL_KEYS[nextOp])}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        {(["component", "full"] as Scope[]).map((nextScope) => (
          <button
            key={nextScope}
            type="button"
            onClick={() => setScope(nextScope)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              scope === nextScope
                ? "border border-primary/45 bg-primary/10 font-medium text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(SCOPE_LABEL_KEYS[nextScope])}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton
            text={result?.ok ? result.value : ""}
            onCopied={() => result?.ok && record(input, result.value)}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          aria-label={t("tools.url.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.url.placeholder")}
          className="h-full min-h-64 resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <div className="flex min-h-0 flex-col gap-3">
          <OutputPane result={result} emptyHint={t("tools.url.empty")} />
          {query.ok && query.value.length > 0 && (
            <div className="overflow-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5">{t("tools.url.table.key")}</th>
                    <th className="px-3 py-1.5">{t("tools.url.table.value")}</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {query.value.map((param, index) => (
                    <tr key={`${param.key}:${index}`} className="border-t border-border">
                      <td className="px-3 py-1.5">{param.key}</td>
                      <td className="px-3 py-1.5">{param.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
