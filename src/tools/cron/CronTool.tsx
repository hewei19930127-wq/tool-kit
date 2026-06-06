import { useMemo } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { describeCron, nextRuns } from "./cron";

const PRESETS: { label: string; expr: string }[] = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Every 5 min", expr: "*/5 * * * *" },
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily midnight", expr: "0 0 * * *" },
  { label: "Weekdays 9am", expr: "0 9 * * 1-5" },
];

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export default function CronTool() {
  const [input, setInput] = useToolInput("cron");

  const description = useMemo(
    () => (input.trim() ? describeCron(input) : null),
    [input],
  );
  const runs = useMemo(
    () => (input.trim() ? nextRuns(input, 5, Date.now(), timeZone) : null),
    [input, timeZone],
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
            {preset.label}
          </button>
        ))}
      </div>

      <input
        aria-label="Cron expression"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="e.g. */5 * * * *"
        className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />

      {description?.ok && (
        <p aria-label="Description" className="text-sm">
          {description.value}
        </p>
      )}
      {description && !description.ok && (
        <p role="alert" className="text-sm text-error">
          {description.error}
        </p>
      )}

      {runs?.ok && (
        <div className="flex min-h-0 flex-col overflow-auto">
          <div className="text-xs uppercase text-muted-foreground">
            Next 5 runs / {timeZone}
          </div>
          {runs.value.map((run) => (
            <div
              key={run}
              className="border-b border-border py-1.5 font-mono text-sm"
            >
              {run}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
