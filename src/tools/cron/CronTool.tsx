import { useMemo } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { type I18nKey, useI18n } from "@/core/i18n";
import { resultError } from "@/core/i18n/result";
import { describeCron, nextRuns } from "./cron";

const PRESETS: { labelKey: I18nKey; expr: string }[] = [
  { labelKey: "tools.cron.presets.everyMinute", expr: "* * * * *" },
  { labelKey: "tools.cron.presets.every5Min", expr: "*/5 * * * *" },
  { labelKey: "tools.cron.presets.hourly", expr: "0 * * * *" },
  { labelKey: "tools.cron.presets.dailyMidnight", expr: "0 0 * * *" },
  { labelKey: "tools.cron.presets.weekdays9am", expr: "0 9 * * 1-5" },
];

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export default function CronTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("cron");

  const description = useMemo(() => (input.trim() ? describeCron(input) : null), [input]);
  const runs = useMemo(
    () => (input.trim() ? nextRuns(input, 5, Date.now(), timeZone) : null),
    [input],
  );

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.expr}
            type="button"
            onClick={() => setInput(preset.expr)}
            className="rounded-md border border-border px-2 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t(preset.labelKey)}
          </button>
        ))}
      </div>

      <input
        aria-label={t("tools.cron.input")}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={t("tools.cron.placeholder")}
        className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />

      {description?.ok && (
        <p aria-label={t("tools.cron.description")} className="text-sm">
          {description.value}
        </p>
      )}
      {description && !description.ok && (
        <p role="alert" className="text-sm text-error">
          {resultError(description, t)}
        </p>
      )}

      {runs?.ok && (
        <div className="flex min-h-0 flex-col overflow-auto">
          <div className="text-xs uppercase text-muted-foreground">
            {t("tools.cron.nextRuns", { timeZone })}
          </div>
          {runs.value.map((run) => (
            <div key={run} className="border-b border-border py-1.5 font-mono text-sm">
              {run}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
