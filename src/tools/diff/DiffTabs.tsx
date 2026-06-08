import { Plus, X } from "lucide-react";
import { useI18n } from "@/core/i18n";
import { useAppStore } from "@/core/store";

export function DiffTabs() {
  const { t } = useI18n();
  const tabs = useAppStore((state) => state.diff.tabs);
  const activeTabId = useAppStore((state) => state.diff.activeTabId);
  const addDiffTab = useAppStore((state) => state.addDiffTab);
  const closeDiffTab = useAppStore((state) => state.closeDiffTab);
  const setActiveDiffTab = useAppStore((state) => state.setActiveDiffTab);
  const canClose = tabs.length > 1;

  return (
    <div
      role="tablist"
      aria-label={t("tools.diff.name")}
      className="flex min-h-10 items-center gap-1 overflow-x-auto border-b border-border pb-2"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const label = t("tools.diff.tab.label", { n: tab.seq });
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
              onClick={() => setActiveDiffTab(tab.id)}
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
    </div>
  );
}
