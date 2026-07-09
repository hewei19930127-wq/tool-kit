import { useEffect } from "react";
import { ToolTabs } from "@/components/ToolTabs";
import { type I18nKey, useI18n } from "@/core/i18n";
import { type TextTabToolId, useAppStore } from "@/core/store";

const TAB_KEYS: Record<
  TextTabToolId,
  {
    ariaLabel: I18nKey;
    newTab: I18nKey;
    closeTab: I18nKey;
    menu: I18nKey;
    rename: I18nKey;
    renameHint: I18nKey;
    closeOthers: I18nKey;
    closeRight: I18nKey;
    closeAll: I18nKey;
    label: I18nKey;
  }
> = {
  json: {
    ariaLabel: "tools.json.name",
    newTab: "tools.json.tab.new",
    closeTab: "tools.json.tab.close",
    menu: "tools.json.tab.menu",
    rename: "tools.json.tab.rename",
    renameHint: "tools.json.tab.renameHint",
    closeOthers: "tools.json.tab.closeOthers",
    closeRight: "tools.json.tab.closeRight",
    closeAll: "tools.json.tab.closeAll",
    label: "tools.json.tab.label",
  },
  xml: {
    ariaLabel: "tools.xml.name",
    newTab: "tools.xml.tab.new",
    closeTab: "tools.xml.tab.close",
    menu: "tools.xml.tab.menu",
    rename: "tools.xml.tab.rename",
    renameHint: "tools.xml.tab.renameHint",
    closeOthers: "tools.xml.tab.closeOthers",
    closeRight: "tools.xml.tab.closeRight",
    closeAll: "tools.xml.tab.closeAll",
    label: "tools.xml.tab.label",
  },
};

interface TextTabsProps {
  toolId: TextTabToolId;
}

export function TextTabs({ toolId }: TextTabsProps) {
  const { t } = useI18n();
  const keys = TAB_KEYS[toolId];
  const slice = useAppStore((state) => state.textTabs[toolId]);
  const addTextTab = useAppStore((state) => state.addTextTab);
  const closeTextTab = useAppStore((state) => state.closeTextTab);
  const closeOtherTextTabs = useAppStore((state) => state.closeOtherTextTabs);
  const closeTextTabsToRight = useAppStore((state) => state.closeTextTabsToRight);
  const closeAllTextTabs = useAppStore((state) => state.closeAllTextTabs);
  const setActiveTextTab = useAppStore((state) => state.setActiveTextTab);
  const renameTextTab = useAppStore((state) => state.renameTextTab);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const store = useAppStore.getState();
      const current = store.textTabs[toolId];
      if (event.shiftKey && (event.code === "BracketLeft" || event.code === "BracketRight")) {
        const index = current.tabs.findIndex((tab) => tab.id === current.activeTabId);
        if (index === -1) return;
        event.preventDefault();
        const delta = event.code === "BracketLeft" ? -1 : 1;
        store.setActiveTextTab(
          toolId,
          current.tabs[(index + delta + current.tabs.length) % current.tabs.length].id,
        );
        return;
      }
      if (event.key === "t") {
        event.preventDefault();
        store.addTextTab(toolId);
        return;
      }
      if (event.key === "w") {
        if (current.tabs.length > 1) {
          event.preventDefault();
          store.closeTextTab(toolId, current.activeTabId);
        }
        return;
      }
      if (event.key.length === 1 && event.key >= "1" && event.key <= "9") {
        const tab = current.tabs[Number(event.key) - 1];
        if (tab) {
          event.preventDefault();
          store.setActiveTextTab(toolId, tab.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolId]);

  return (
    <ToolTabs
      tabs={slice.tabs}
      activeTabId={slice.activeTabId}
      labels={{
        ariaLabel: t(keys.ariaLabel),
        newTab: t(keys.newTab),
        closeTab: t(keys.closeTab),
        menu: t(keys.menu),
        rename: t(keys.rename),
        renameHint: t(keys.renameHint),
        closeOthers: t(keys.closeOthers),
        closeRight: t(keys.closeRight),
        closeAll: t(keys.closeAll),
      }}
      getLabel={(tab) => tab.name?.trim() || t(keys.label, { n: tab.seq })}
      onAdd={() => addTextTab(toolId)}
      onClose={(id) => closeTextTab(toolId, id)}
      onCloseOthers={(id) => closeOtherTextTabs(toolId, id)}
      onCloseRight={(id) => closeTextTabsToRight(toolId, id)}
      onCloseAll={() => closeAllTextTabs(toolId)}
      onActivate={(id) => setActiveTextTab(toolId, id)}
      onRename={(id, name) => renameTextTab(toolId, id, name)}
    />
  );
}
