import { AlertCircle, Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/core/i18n";
import { writeClipboardText } from "@/core/services/clipboard";

type CopyStatus = "idle" | "copied" | "failed";

export function CopyButton({
  text,
  onCopied,
  disabled,
}: {
  text: string;
  onCopied?: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function showTemporaryStatus(nextStatus: CopyStatus) {
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    setStatus(nextStatus);
    resetTimer.current = window.setTimeout(() => {
      setStatus("idle");
      resetTimer.current = null;
    }, 1200);
  }

  async function copy() {
    if (!text) return;

    try {
      await writeClipboardText(text);
      onCopied?.();
      showTemporaryStatus("copied");
    } catch {
      showTemporaryStatus("failed");
    }
  }

  const presentation = {
    idle: {
      icon: <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />,
      label: t("components.copy.copy"),
    },
    copied: {
      icon: <Check className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />,
      label: t("components.copy.copied"),
    },
    failed: {
      icon: <AlertCircle className="h-3.5 w-3.5 text-error" strokeWidth={1.75} />,
      label: t("components.copy.failed"),
    },
  }[status];

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled || !text}
      aria-label={t("components.copy.output")}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
    >
      {presentation.icon}
      {presentation.label}
    </button>
  );
}
