import { getTool } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function DetailHost() {
  const activeToolId = useAppStore((state) => state.activeToolId);
  const tool = getTool(activeToolId);

  if (!tool) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Pick a tool from the sidebar, or press
          <kbd className="mx-1 rounded border border-border px-1.5 py-0.5 font-mono text-xs">
            ⌘K
          </kbd>
          to search.
        </p>
      </div>
    );
  }

  const Icon = tool.icon;
  const ToolComponent = tool.component;

  return (
    <main className="flex h-full flex-1 flex-col">
      <header className="flex h-10 items-center gap-2 border-b border-border px-4">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        <h1 className="text-sm font-medium">{tool.name}</h1>
      </header>
      <div className="min-h-0 flex-1">
        <ToolComponent />
      </div>
    </main>
  );
}
