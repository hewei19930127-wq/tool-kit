import { useMemo, useState } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { type I18nKey, type TFunction, useI18n } from "@/core/i18n";
import { resultError } from "@/core/i18n/result";
import type { ToolResult } from "@/core/types";
import {
  convertTimezone,
  formatCustom,
  relativeFrom,
  toEpochMillis,
  toEpochSeconds,
  toIso,
} from "./time";

function Row({
  labelKey,
  label,
  result,
  t,
}: {
  labelKey?: I18nKey;
  label?: string;
  result: ToolResult;
  t: TFunction;
}) {
  const rowLabel = label ?? (labelKey ? t(labelKey) : "");

  return (
    <div className="flex items-baseline gap-3 border-b border-border py-2">
      <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">{rowLabel}</span>
      {result.ok ? (
        <span aria-label={rowLabel} className="break-all font-mono text-sm">
          {result.value}
        </span>
      ) : (
        <span aria-label={rowLabel} className="font-mono text-sm text-error">
          {resultError(result, t)}
        </span>
      )}
    </div>
  );
}

export default function TimeTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("time");
  const [pattern, setPattern] = useState("YYYY-MM-DD HH:mm:ss");
  const [tz, setTz] = useState("Asia/Singapore");

  const now = Date.now();
  const rows = useMemo(() => {
    if (!input.trim()) return null;
    return {
      iso: toIso(input),
      seconds: toEpochSeconds(input),
      millis: toEpochMillis(input),
      relative: relativeFrom(input, now),
      custom: formatCustom(input, pattern),
      zoned: convertTimezone(input, tz),
    };
  }, [input, now, pattern, tz]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={t("tools.time.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.time.placeholder")}
          className="min-w-72 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t("tools.time.now")}
        </button>
      </div>

      {!rows && <p className="text-sm text-muted-foreground">{t("tools.time.empty")}</p>}

      {rows && (
        <div className="flex min-w-0 flex-col">
          <Row labelKey="tools.time.rows.iso" result={rows.iso} t={t} />
          <Row labelKey="tools.time.rows.epochSeconds" result={rows.seconds} t={t} />
          <Row labelKey="tools.time.rows.epochMillis" result={rows.millis} t={t} />
          <Row labelKey="tools.time.rows.relative" result={rows.relative} t={t} />
          <Row labelKey="tools.time.rows.custom" result={rows.custom} t={t} />
          <div className="flex flex-wrap items-center gap-2 py-2">
            <input
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              aria-label={t("tools.time.formatPattern")}
              className="w-56 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <input
              value={tz}
              onChange={(event) => setTz(event.target.value)}
              aria-label={t("tools.time.timezone")}
              placeholder={t("tools.time.timezonePlaceholder")}
              className="w-56 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <Row
            label={t("tools.time.rows.inTimezone", { timezone: tz })}
            result={rows.zoned}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
