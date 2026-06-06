import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useState } from "react";
import { getTool, tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function useClipboardDetect(): {
  text: string | null;
  suggestedToolId: string | null;
  clear: () => void;
} {
  const activeToolId = useAppStore((state) => state.activeToolId);
  const [text, setText] = useState<string | null>(null);
  const [suggestedToolId, setSuggestedToolId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readText()
      .then((clipboardText) => {
        if (!active) return;
        if (!clipboardText) {
          setText(null);
          setSuggestedToolId(null);
          return;
        }

        const tool = getTool(activeToolId);
        if (tool?.detectClipboard?.(clipboardText)) {
          setText(clipboardText);
          setSuggestedToolId(null);
          return;
        }

        const match = tools.find(
          (candidate) =>
            candidate.id !== activeToolId &&
            candidate.detectClipboard?.(clipboardText),
        );
        setText(match ? clipboardText : null);
        setSuggestedToolId(match ? match.id : null);
      })
      .catch(() => {
        if (active) {
          setText(null);
          setSuggestedToolId(null);
        }
      });

    return () => {
      active = false;
    };
  }, [activeToolId]);

  return {
    text,
    suggestedToolId,
    clear: () => {
      setText(null);
      setSuggestedToolId(null);
    },
  };
}
