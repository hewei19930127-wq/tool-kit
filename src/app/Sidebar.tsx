import { Settings as SettingsIcon, Star } from "lucide-react";
import { tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

function ToolRow({ tool }: { tool: (typeof tools)[number] }) {
  const active = useAppStore((state) => state.activeToolId === tool.id);
  const favorite = useAppStore((state) => state.favorites.includes(tool.id));
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);

  const Icon = tool.icon;

  return (
    <div
      className={`group grid grid-cols-[1fr_28px] items-center rounded-md ${
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
      }`}
    >
      <button
        type="button"
        onClick={() => setActiveTool(tool.id)}
        className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{tool.name}</span>
      </button>
      <button
        type="button"
        aria-label={favorite ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
        onClick={() => toggleFavorite(tool.id)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100"
      >
        <Star
          className={`h-3.5 w-3.5 ${favorite ? "fill-favorite text-favorite" : ""}`}
          strokeWidth={1.75}
        />
      </button>
    </div>
  );
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const favorites = useAppStore((state) => state.favorites);
  const pinned = tools.filter((tool) => favorites.includes(tool.id));
  const rest = tools.filter((tool) => !favorites.includes(tool.id));

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-border bg-background p-2">
      <div className="px-2 py-1.5 text-sm font-semibold">ToolKit</div>
      {pinned.length > 0 && (
        <>
          <div className="px-2 pt-2 text-xs font-medium uppercase text-muted-foreground">
            Favorites
          </div>
          {pinned.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
          <div className="my-1 h-px bg-border" />
        </>
      )}
      {rest.map((tool) => (
        <ToolRow key={tool.id} tool={tool} />
      ))}
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
      >
        <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
