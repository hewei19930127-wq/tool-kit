import { Hammer, Search, Settings as SettingsIcon, Star } from "lucide-react";
import { useI18n } from "@/core/i18n";
import { tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

function ToolRow({
  tool,
  onSelectTool,
}: {
  tool: (typeof tools)[number];
  onSelectTool: (toolId: string) => void;
}) {
  const active = useAppStore((state) => state.activeToolId === tool.id);
  const favorite = useAppStore((state) => state.favorites.includes(tool.id));
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const { t } = useI18n();

  const Icon = tool.icon;
  const toolName = t(tool.nameKey);

  return (
    <div
      className={`group relative grid grid-cols-[1fr_28px] items-center rounded-lg transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <button
        type="button"
        onClick={() => onSelectTool(tool.id)}
        className="flex min-w-0 items-center gap-2.5 px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className={`truncate ${active ? "font-medium" : ""}`}>{toolName}</span>
      </button>
      <button
        type="button"
        aria-label={t(favorite ? "app.sidebar.unpinTool" : "app.sidebar.pinTool", {
          tool: toolName,
        })}
        onClick={() => toggleFavorite(tool.id)}
        className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100 ${
          favorite ? "opacity-100" : "opacity-0"
        }`}
      >
        <Star
          className={`h-3.5 w-3.5 ${favorite ? "fill-favorite text-favorite" : ""}`}
          strokeWidth={1.75}
        />
      </button>
    </div>
  );
}

export function Sidebar({
  onOpenSettings,
  onOpenPalette,
  onSelectTool,
}: {
  onOpenSettings: () => void;
  onOpenPalette: () => void;
  onSelectTool: (toolId: string) => void;
}) {
  const { t } = useI18n();
  const favorites = useAppStore((state) => state.favorites);
  const pinned = tools.filter((tool) => favorites.includes(tool.id));
  const rest = tools.filter((tool) => !favorites.includes(tool.id));

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Clearance strip for the macOS overlay title bar traffic lights. */}
      <div data-tauri-drag-region="deep" className="h-8 shrink-0" />
      <div data-tauri-drag-region="deep" className="flex items-center gap-2.5 px-4 pb-3 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Hammer className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="font-display text-[15px] font-semibold tracking-tight">
          {t("app.brand")}
        </span>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          aria-label={t("app.sidebar.search")}
          onClick={onOpenPalette}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted-foreground shadow-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-left">{t("app.sidebar.search")}</span>
          <kbd className="rounded border border-border bg-muted px-1 py-px text-[10px] leading-4 text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
        {pinned.length > 0 && (
          <>
            <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {t("app.sidebar.favorites")}
            </div>
            {pinned.map((tool) => (
              <ToolRow key={tool.id} tool={tool} onSelectTool={onSelectTool} />
            ))}
          </>
        )}
        <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {t("app.command.tools")}
        </div>
        {rest.map((tool) => (
          <ToolRow key={tool.id} tool={tool} onSelectTool={onSelectTool} />
        ))}
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          aria-label={t("app.sidebar.settings")}
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
          <span className="flex-1">{t("app.sidebar.settings")}</span>
          <kbd className="rounded border border-border bg-muted px-1 py-px text-[10px] leading-4 text-muted-foreground">
            ⌘,
          </kbd>
        </button>
      </div>
    </nav>
  );
}
