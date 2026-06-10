import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { OutputPane } from "@/components/OutputPane";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { type I18nKey, useI18n } from "@/core/i18n";
import { decodeBase64, encodeBase64 } from "./base64";

type Mode = "encode" | "decode";
const MODE_LABEL_KEYS: Record<Mode, I18nKey> = {
  encode: "tools.base64.actions.encode",
  decode: "tools.base64.actions.decode",
};

export default function Base64Tool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("base64");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const { entries, record } = useHistory("base64");

  const result = useMemo(() => {
    if (!input) return null;
    return mode === "encode" ? encodeBase64(input, urlSafe) : decodeBase64(input, urlSafe);
  }, [input, mode, urlSafe]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["encode", "decode"] as Mode[]).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setMode(nextMode)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === nextMode
                ? "border border-primary/45 bg-primary/10 font-medium text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(MODE_LABEL_KEYS[nextMode])}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={urlSafe}
            onChange={(event) => setUrlSafe(event.target.checked)}
          />
          {t("tools.base64.urlSafe")}
        </label>
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
          aria-label={t("tools.base64.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t(
            mode === "encode"
              ? "tools.base64.placeholder.encode"
              : "tools.base64.placeholder.decode",
          )}
          className="h-full min-h-64 resize-none rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-5 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <OutputPane result={result} emptyHint={t("tools.base64.empty")} />
      </div>
    </div>
  );
}
