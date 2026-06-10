import { Search } from "lucide-react";
import { useI18n } from "@/core/i18n";
import { getTool } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function DetailHost() {
  const { t } = useI18n();
  const activeToolId = useAppStore((state) => state.activeToolId);
  const tool = getTool(activeToolId);

  if (!tool) {
    return (
      <div data-tauri-drag-region="deep" className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-muted-foreground shadow-xs">
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <p className="max-w-64 text-sm leading-6 text-muted-foreground">
            {t("app.detail.emptyPrefix")}
            <kbd className="mx-1 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs shadow-xs">
              ⌘K
            </kbd>
            {t("app.detail.emptySuffix")}
          </p>
        </div>
      </div>
    );
  }

  const Icon = tool.icon;
  const ToolComponent = tool.component;

  return (
    <main className="flex h-full flex-1 flex-col">
      <header
        data-tauri-drag-region="deep"
        className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <h1 className="text-sm font-semibold tracking-tight">{t(tool.nameKey)}</h1>
      </header>
      <div className="min-h-0 flex-1">
        <ToolComponent />
      </div>
    </main>
  );
}
