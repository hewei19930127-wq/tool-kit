import { ClipboardPaste, X } from "lucide-react";

export function ClipboardBanner({
  text,
  onFill,
  onDismiss,
}: {
  text: string;
  onFill: (text: string) => void;
  onDismiss: () => void;
}) {
  const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;

  return (
    <div className="flex min-h-10 items-center gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
      <ClipboardPaste className="h-4 w-4 text-primary" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        Clipboard looks fillable: <span className="font-mono">{preview}</span>
      </span>
      <button
        type="button"
        onClick={() => onFill(text)}
        className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
      >
        Fill
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss clipboard suggestion"
        className="rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
