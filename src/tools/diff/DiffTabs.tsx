import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type I18nKey, useI18n } from "@/core/i18n";
import { useAppStore } from "@/core/store";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 208;
const MENU_HEIGHT = 168;

const menuItemClass = cn(
  "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none",
  "hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50",
);

export function DiffTabs() {
  const { t } = useI18n();
  const tabs = useAppStore((state) => state.diff.tabs);
  const activeTabId = useAppStore((state) => state.diff.activeTabId);
  const addDiffTab = useAppStore((state) => state.addDiffTab);
  const closeDiffTab = useAppStore((state) => state.closeDiffTab);
  const closeOtherDiffTabs = useAppStore((state) => state.closeOtherDiffTabs);
  const closeDiffTabsToRight = useAppStore((state) => state.closeDiffTabsToRight);
  const closeAllDiffTabs = useAppStore((state) => state.closeAllDiffTabs);
  const setActiveDiffTab = useAppStore((state) => state.setActiveDiffTab);
  const renameDiffTab = useAppStore((state) => state.renameDiffTab);
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
    if (!cancelledRef.current && editingId) renameDiffTab(editingId, draft);
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

  const menuItem = (labelKey: I18nKey, action: () => void, disabled?: boolean) => (
    <button
      key={labelKey}
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => runMenuAction(action)}
      className={menuItemClass}
    >
      {t(labelKey)}
    </button>
  );

  return (
    <div
      role="tablist"
      aria-label={t("tools.diff.name")}
      className="flex min-h-10 items-center gap-1 overflow-x-auto border-b border-border pb-2"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const label = tab.name?.trim() || t("tools.diff.tab.label", { n: tab.seq });

        if (tab.id === editingId) {
          return (
            <input
              key={tab.id}
              ref={inputRef}
              type="text"
              aria-label={t("tools.diff.tab.rename")}
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
              className="h-8 min-w-20 shrink-0 rounded-md border border-primary bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          );
        }

        return (
          <div
            key={tab.id}
            className={`flex h-8 shrink-0 items-center overflow-hidden rounded-md border ${
              active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={t("tools.diff.tab.renameHint")}
              onClick={() => setActiveDiffTab(tab.id)}
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
                aria-label={`${t("tools.diff.tab.close")} ${label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeDiffTab(tab.id);
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
        aria-label={t("tools.diff.tab.new")}
        onClick={addDiffTab}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {menu && menuTab && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("tools.diff.tab.menu")}
          style={{
            left: Math.max(8, Math.min(menu.x, window.innerWidth - MENU_WIDTH)),
            top: Math.max(8, Math.min(menu.y, window.innerHeight - MENU_HEIGHT)),
          }}
          className="fixed z-50 min-w-52 rounded-md border border-border bg-background p-1 shadow-md"
        >
          {menuItem("tools.diff.tab.rename", () => startRename(menuTab.id, menuTab.name))}
          <div className="my-1 h-px bg-border" />
          {menuItem(
            "tools.diff.tab.closeOthers",
            () => closeOtherDiffTabs(menuTab.id),
            tabs.length <= 1,
          )}
          {menuItem(
            "tools.diff.tab.closeRight",
            () => closeDiffTabsToRight(menuTab.id),
            menuIndex >= tabs.length - 1,
          )}
          {menuItem("tools.diff.tab.closeAll", () => closeAllDiffTabs())}
        </div>
      )}
    </div>
  );
}
