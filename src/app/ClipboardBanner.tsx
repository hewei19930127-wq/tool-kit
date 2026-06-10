import { ClipboardPaste, X } from "lucide-react";
import { type I18nKey, useI18n } from "@/core/i18n";

export function ClipboardBanner({
  text,
  suggestionNameKey,
  onFill,
  onOpenSuggestion,
  onDismiss,
}: {
  text: string;
  suggestionNameKey?: I18nKey;
  onFill: (text: string) => void;
  onOpenSuggestion?: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
  const suggestionName = suggestionNameKey ? t(suggestionNameKey) : null;

  return (
    <div className="flex min-h-10 items-center gap-2.5 border-b border-primary/20 bg-primary/8 px-4 py-2 text-sm">
      <ClipboardPaste className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {t("app.clipboard.label")} <span className="font-mono text-foreground">{preview}</span>
      </span>
      {suggestionName ? (
        <button
          type="button"
          onClick={onOpenSuggestion}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t("app.clipboard.openIn", { tool: suggestionName })}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onFill(text)}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t("app.clipboard.fill")}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("app.clipboard.dismiss")}
        className="rounded-md p-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
