import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, makeDefaultDiffSlice, useAppStore } from "./store";

describe("app store", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeToolId: null,
      favorites: [],
      theme: "system",
      language: DEFAULT_LANGUAGE,
      hotkey: "Alt+Space",
      toolInputs: {},
      diff: makeDefaultDiffSlice(),
    });
  });

  it("sets the active tool", () => {
    useAppStore.getState().setActiveTool("json");
    expect(useAppStore.getState().activeToolId).toBe("json");
  });

  it("toggles a favorite on and off", () => {
    const { toggleFavorite } = useAppStore.getState();
    toggleFavorite("json");
    expect(useAppStore.getState().favorites).toEqual(["json"]);
    toggleFavorite("json");
    expect(useAppStore.getState().favorites).toEqual([]);
  });

  it("hydrates persisted slices", () => {
    useAppStore.getState().hydrate({ favorites: ["base64"], theme: "dark", language: "zh-CN" });
    expect(useAppStore.getState().favorites).toEqual(["base64"]);
    expect(useAppStore.getState().theme).toBe("dark");
    expect(useAppStore.getState().language).toBe("zh-CN");
  });

  it("updates the language", () => {
    useAppStore.getState().setLanguage("en");
    expect(useAppStore.getState().language).toBe("en");
  });

  it("hydrates the hotkey", () => {
    useAppStore.getState().hydrate({ hotkey: "Control+Space" });
    expect(useAppStore.getState().hotkey).toBe("Control+Space");
  });

  it("updates the hotkey", () => {
    useAppStore.getState().setHotkey("Alt+Shift+Space");
    expect(useAppStore.getState().hotkey).toBe("Alt+Shift+Space");
  });

  it("sets and overwrites a tool's input independently", () => {
    const { setToolInput } = useAppStore.getState();
    setToolInput("json", "{}");
    setToolInput("base64", "aGk=");
    expect(useAppStore.getState().toolInputs).toEqual({
      json: "{}",
      base64: "aGk=",
    });
    setToolInput("json", "[]");
    expect(useAppStore.getState().toolInputs.json).toBe("[]");
  });

  it("adds a diff tab and activates it", () => {
    const firstTab = useAppStore.getState().diff.tabs[0];
    useAppStore.getState().addDiffTab();

    const { activeTabId, nextSeq, tabs } = useAppStore.getState().diff;
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toBe(firstTab);
    expect(tabs[1]).toMatchObject({ seq: 2, a: "", b: "" });
    expect(activeTabId).toBe(tabs[1].id);
    expect(nextSeq).toBe(3);
  });

  it("does not close the last diff tab", () => {
    const tab = useAppStore.getState().diff.tabs[0];
    useAppStore.getState().closeDiffTab(tab.id);

    expect(useAppStore.getState().diff.tabs).toEqual([tab]);
    expect(useAppStore.getState().diff.activeTabId).toBe(tab.id);
  });

  it("activates the previous neighbor when closing the active diff tab", () => {
    const { addDiffTab, closeDiffTab, setActiveDiffTab } = useAppStore.getState();
    addDiffTab();
    addDiffTab();
    const [, secondTab] = useAppStore.getState().diff.tabs;

    setActiveDiffTab(secondTab.id);
    closeDiffTab(secondTab.id);

    const { activeTabId, tabs } = useAppStore.getState().diff;
    expect(tabs.map((tab) => tab.seq)).toEqual([1, 3]);
    expect(activeTabId).toBe(tabs[0].id);
  });

  it("keeps diff tab sequence numbers stable after closing a middle tab", () => {
    const { addDiffTab, closeDiffTab } = useAppStore.getState();
    addDiffTab();
    addDiffTab();
    const secondTab = useAppStore.getState().diff.tabs[1];

    closeDiffTab(secondTab.id);
    addDiffTab();

    expect(useAppStore.getState().diff.tabs.map((tab) => tab.seq)).toEqual([1, 3, 4]);
  });

  it("renames a diff tab and clears the name when blank", () => {
    const { renameDiffTab } = useAppStore.getState();
    const tab = useAppStore.getState().diff.tabs[0];

    renameDiffTab(tab.id, "  API payload  ");
    expect(useAppStore.getState().diff.tabs[0].name).toBe("API payload");

    renameDiffTab(tab.id, "   ");
    expect(useAppStore.getState().diff.tabs[0].name).toBeUndefined();
  });

  it("ignores renaming an unknown diff tab", () => {
    const before = useAppStore.getState().diff;
    useAppStore.getState().renameDiffTab("missing", "nope");
    expect(useAppStore.getState().diff).toBe(before);
  });

  it("updates only the requested diff tab side", () => {
    const { addDiffTab, setDiffTabSide } = useAppStore.getState();
    const firstTab = useAppStore.getState().diff.tabs[0];
    addDiffTab();
    const secondTab = useAppStore.getState().diff.tabs[1];

    setDiffTabSide(secondTab.id, "b", "changed");

    expect(useAppStore.getState().diff.tabs).toEqual([firstTab, { ...secondTab, b: "changed" }]);
  });

  it("restarts diff numbering when closing down to a single tab", () => {
    const { addDiffTab, closeDiffTab } = useAppStore.getState();
    addDiffTab();
    const [firstTab, secondTab] = useAppStore.getState().diff.tabs;

    // Close the first tab, leaving only the second (originally "Diff 2").
    closeDiffTab(firstTab.id);

    const { tabs, nextSeq } = useAppStore.getState().diff;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(secondTab.id);
    expect(tabs[0].seq).toBe(1);
    expect(nextSeq).toBe(2);

    addDiffTab();
    expect(useAppStore.getState().diff.tabs.map((tab) => tab.seq)).toEqual([1, 2]);
  });

  it("closes other diff tabs and renumbers the survivor", () => {
    const { addDiffTab, closeOtherDiffTabs } = useAppStore.getState();
    addDiffTab();
    addDiffTab();
    const kept = useAppStore.getState().diff.tabs[1];

    closeOtherDiffTabs(kept.id);

    const { tabs, activeTabId, nextSeq } = useAppStore.getState().diff;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(kept.id);
    expect(tabs[0].seq).toBe(1);
    expect(activeTabId).toBe(kept.id);
    expect(nextSeq).toBe(2);
  });

  it("closes diff tabs to the right of the target", () => {
    const { addDiffTab, closeDiffTabsToRight } = useAppStore.getState();
    addDiffTab();
    addDiffTab();
    addDiffTab();
    const second = useAppStore.getState().diff.tabs[1];

    closeDiffTabsToRight(second.id);

    const { tabs, activeTabId } = useAppStore.getState().diff;
    expect(tabs.map((tab) => tab.seq)).toEqual([1, 2]);
    // The active tab (the last one) was closed, so focus falls back to the target.
    expect(activeTabId).toBe(second.id);
  });

  it("does nothing when there are no diff tabs to the right", () => {
    const before = useAppStore.getState().diff;
    const only = before.tabs[0];
    useAppStore.getState().closeDiffTabsToRight(only.id);
    expect(useAppStore.getState().diff).toBe(before);
  });

  it("closes all diff tabs back to a single blank Diff 1", () => {
    const { addDiffTab, setDiffTabSide, closeAllDiffTabs } = useAppStore.getState();
    addDiffTab();
    const active = useAppStore.getState().diff.activeTabId;
    setDiffTabSide(active, "a", "leftover");

    closeAllDiffTabs();

    const { tabs, nextSeq, activeTabId } = useAppStore.getState().diff;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ seq: 1, a: "", b: "" });
    expect(tabs[0].id).toBe(activeTabId);
    expect(nextSeq).toBe(2);
  });

  it("repairs a stale active diff tab during hydration", () => {
    useAppStore.getState().hydrate({
      diff: {
        tabs: [{ id: "one", seq: 1, a: "left", b: "right" }],
        activeTabId: "missing",
        nextSeq: 2,
        mode: "word",
        view: "inline",
      },
    });

    expect(useAppStore.getState().diff).toEqual({
      tabs: [{ id: "one", seq: 1, a: "left", b: "right" }],
      activeTabId: "one",
      nextSeq: 2,
      mode: "word",
      view: "inline",
    });
  });
});
