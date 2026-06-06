import { useCallback, useEffect, useState } from "react";
import { type HistoryEntry, pushHistory } from "@/core/services/history";
import { storage } from "@/core/services/storage";

const key = (toolId: string) => `history:${toolId}`;

export function useHistory(toolId: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    storage()
      .get<HistoryEntry[]>(key(toolId))
      .then((stored) => {
        if (active) setEntries(stored ?? []);
      });
    return () => {
      active = false;
    };
  }, [toolId]);

  const record = useCallback(
    (input: string, output: string) => {
      if (!input.trim()) return;
      setEntries((previous) => {
        const next = pushHistory(previous, { input, output, ts: Date.now() });
        void storage().set(key(toolId), next);
        return next;
      });
    },
    [toolId],
  );

  return { entries, record };
}
