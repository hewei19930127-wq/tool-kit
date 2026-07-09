import { ToolTabs } from "@/components/ToolTabs";
import { useI18n } from "@/core/i18n";
import { useAppStore } from "@/core/store";

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

  return (
    <ToolTabs
      tabs={tabs}
      activeTabId={activeTabId}
      labels={{
        ariaLabel: t("tools.diff.name"),
        newTab: t("tools.diff.tab.new"),
        closeTab: t("tools.diff.tab.close"),
        menu: t("tools.diff.tab.menu"),
        rename: t("tools.diff.tab.rename"),
        renameHint: t("tools.diff.tab.renameHint"),
        closeOthers: t("tools.diff.tab.closeOthers"),
        closeRight: t("tools.diff.tab.closeRight"),
        closeAll: t("tools.diff.tab.closeAll"),
      }}
      getLabel={(tab) => tab.name?.trim() || t("tools.diff.tab.label", { n: tab.seq })}
      onAdd={addDiffTab}
      onClose={closeDiffTab}
      onCloseOthers={closeOtherDiffTabs}
      onCloseRight={closeDiffTabsToRight}
      onCloseAll={closeAllDiffTabs}
      onActivate={setActiveDiffTab}
      onRename={renameDiffTab}
    />
  );
}
