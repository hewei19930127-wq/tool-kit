import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useState } from "react";
import { getTool } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function useClipboardDetect(): {
  text: string | null;
  clear: () => void;
} {
  const activeToolId = useAppStore((state) => state.activeToolId);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const tool = getTool(activeToolId);
    if (!tool?.detectClipboard) {
      setText(null);
      return;
    }

    readText()
      .then((clipboardText) => {
        if (active && clipboardText && tool.detectClipboard?.(clipboardText)) {
          setText(clipboardText);
        } else if (active) {
          setText(null);
        }
      })
      .catch(() => {
        if (active) setText(null);
      });

    return () => {
      active = false;
    };
  }, [activeToolId]);

  return { text, clear: () => setText(null) };
}
