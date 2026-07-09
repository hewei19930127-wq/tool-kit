import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ToolTabItem {
  id: string;
  name?: string;
}

interface ToolTabsLabels {
  ariaLabel: string;
  newTab: string;
  closeTab: string;
  menu: string;
  rename: string;
  renameHint: string;
  closeOthers: string;
  closeRight: string;
  closeAll: string;
}

interface ToolTabsProps<Tab extends ToolTabItem> {
  tabs: Tab[];
  activeTabId: string;
  labels: ToolTabsLabels;
  getLabel: (tab: Tab) => string;
  onAdd: () => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseRight: (id: string) => void;
  onCloseAll: () => void;
  onActivate: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

const MENU_WIDTH = 208;
const MENU_HEIGHT = 168;

const menuItemClass = cn(
  "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none",
  "hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50",
);

export function ToolTabs<Tab extends ToolTabItem>({
  tabs,
  activeTabId,
  labels,
  getLabel,
  onAdd,
  onClose,
  onCloseOthers,
  onCloseRight,
  onCloseAll,
  onActivate,
  onRename,
}: ToolTabsProps<Tab>) {
  const canClose = tabs.length > 1;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Guards against a blur-on-unmount re-committing a rename the user just cancelled.
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [menu, setMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus and select the rename field when editing starts (replaces the autoFocus
  // attribute, which Biome flags for accessibility).
  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  // Dismiss the context menu on outside click, Escape, scroll, or resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const startRename = (id: string, currentName: string | undefined) => {
    cancelledRef.current = false;
    setEditingId(id);
    setDraft(currentName ?? "");
  };

  const finishRename = () => {
    if (!cancelledRef.current && editingId) onRename(editingId, draft);
    cancelledRef.current = false;
    setEditingId(null);
  };

  const cancelRename = () => {
    cancelledRef.current = true;
    setEditingId(null);
  };

  const menuTab = menu ? (tabs.find((tab) => tab.id === menu.tabId) ?? null) : null;
  const menuIndex = menuTab ? tabs.findIndex((tab) => tab.id === menuTab.id) : -1;

  const runMenuAction = (action: () => void) => {
    action();
    setMenu(null);
  };

  const menuItem = (label: string, action: () => void, disabled?: boolean) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => runMenuAction(action)}
      className={menuItemClass}
    >
      {label}
    </button>
  );

  return (
    <div
      role="tablist"
      aria-label={labels.ariaLabel}
      className="flex min-h-10 items-center gap-1 overflow-x-auto border-b border-border pb-2"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const label = getLabel(tab);

        if (tab.id === editingId) {
          return (
            <input
              key={tab.id}
              ref={inputRef}
              type="text"
              aria-label={labels.rename}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={finishRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  finishRename();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              className="h-8 min-w-20 shrink-0 rounded-md border border-primary/40 bg-surface px-3 text-sm font-medium outline-none"
            />
          );
        }

        return (
          <div
            key={tab.id}
            className={`flex h-8 shrink-0 items-center overflow-hidden rounded-md border ${
              active
                ? "border-primary/45 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={labels.renameHint}
              onClick={() => onActivate(tab.id)}
              onDoubleClick={() => startRename(tab.id, tab.name)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ tabId: tab.id, x: event.clientX, y: event.clientY });
              }}
              className="h-full min-w-20 px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {label}
            </button>
            {canClose && (
              <button
                type="button"
                aria-label={`${labels.closeTab} ${label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.id);
                }}
                className="flex h-full w-7 items-center justify-center outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        aria-label={labels.newTab}
        onClick={onAdd}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {menu && menuTab && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={labels.menu}
          style={{
            left: Math.max(8, Math.min(menu.x, window.innerWidth - MENU_WIDTH)),
            top: Math.max(8, Math.min(menu.y, window.innerHeight - MENU_HEIGHT)),
          }}
          className="fixed z-50 min-w-52 rounded-md border border-border bg-surface p-1 shadow-md"
        >
          {menuItem(labels.rename, () => startRename(menuTab.id, menuTab.name))}
          <div className="my-1 h-px bg-border" />
          {menuItem(labels.closeOthers, () => onCloseOthers(menuTab.id), tabs.length <= 1)}
          {menuItem(
            labels.closeRight,
            () => onCloseRight(menuTab.id),
            menuIndex >= tabs.length - 1,
          )}
          {menuItem(labels.closeAll, onCloseAll)}
        </div>
      )}
    </div>
  );
}
