import { useMemo, useState } from "react";
import type { ToolResult } from "@/core/types";
import { useToolInput } from "@/core/hooks/useToolInput";
import {
  convertTimezone,
  formatCustom,
  relativeFrom,
  toEpochMillis,
  toEpochSeconds,
  toIso,
} from "./time";

function Row({ label, result }: { label: string; result: ToolResult }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border py-2">
      <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">
        {label}
      </span>
      {result.ok ? (
        <span aria-label={label} className="break-all font-mono text-sm">
          {result.value}
        </span>
      ) : (
        <span aria-label={label} className="font-mono text-sm text-error">
          {result.error}
        </span>
      )}
    </div>
  );
}

export default function TimeTool() {
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
          aria-label="Time input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Epoch, ISO, or date..."
          className="min-w-72 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Now
        </button>
      </div>

      {!rows && (
        <p className="text-sm text-muted-foreground">
          Enter a time above to see conversions.
        </p>
      )}

      {rows && (
        <div className="flex min-w-0 flex-col">
          <Row label="ISO 8601" result={rows.iso} />
          <Row label="Epoch (s)" result={rows.seconds} />
          <Row label="Epoch (ms)" result={rows.millis} />
          <Row label="Relative" result={rows.relative} />
          <Row label="Custom" result={rows.custom} />
          <div className="flex flex-wrap items-center gap-2 py-2">
            <input
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              aria-label="Format pattern"
              className="w-56 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <input
              value={tz}
              onChange={(event) => setTz(event.target.value)}
              aria-label="Timezone"
              placeholder="IANA timezone"
              className="w-56 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <Row label={`In ${tz}`} result={rows.zoned} />
        </div>
      )}
    </div>
  );
}
