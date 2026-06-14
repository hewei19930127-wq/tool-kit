import { WrapText } from "lucide-react";
import { useI18n } from "@/core/i18n";
import { useAppStore } from "@/core/store";

/**
 * Toggles the shared word-wrap preference for the JSON/XML/Diff output panes.
 * Reads and writes the global store directly, so every output pane stays in sync.
 */
export function WrapToggle() {
  const { t } = useI18n();
  const wrap = useAppStore((state) => state.wrap);
  const setWrap = useAppStore((state) => state.setWrap);

  return (
    <button
      type="button"
      onClick={() => setWrap(!wrap)}
      aria-label={t("components.wrap.toggle")}
      aria-pressed={wrap}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        wrap
          ? "border-primary/45 bg-primary/10 font-medium text-primary"
          : "border-border hover:bg-muted"
      }`}
    >
      <WrapText className="h-3.5 w-3.5" strokeWidth={1.75} />
      {t("components.wrap.label")}
    </button>
  );
}
