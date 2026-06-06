import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  text,
  onCopied,
  disabled,
}: {
  text: string;
  onCopied?: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await writeText(text);
      onCopied?.();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is unavailable outside Tauri and in some test environments.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled || !text}
      aria-label="Copy output"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
