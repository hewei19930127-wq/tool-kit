import { useState } from "react";
import { History } from "lucide-react";
import type { HistoryEntry } from "@/core/services/history";

export function HistoryButton({
  entries,
  onRestore,
}: {
  entries: HistoryEntry[];
  onRestore: (input: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = (text: string) =>
    text.length > 48 ? `${text.slice(0, 48)}...` : text;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="History"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
      >
        <History className="h-3.5 w-3.5" strokeWidth={1.75} />
        History
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-border bg-background p-1 shadow-md">
          {entries.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No history yet.
            </p>
          )}
          {entries.map((entry) => (
            <button
              key={entry.ts}
              type="button"
              onClick={() => {
                onRestore(entry.input);
                setOpen(false);
              }}
              className="block w-full truncate rounded px-2 py-1.5 text-left font-mono text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              {preview(entry.input)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
