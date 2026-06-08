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

  it("updates only the requested diff tab side", () => {
    const { addDiffTab, setDiffTabSide } = useAppStore.getState();
    const firstTab = useAppStore.getState().diff.tabs[0];
    addDiffTab();
    const secondTab = useAppStore.getState().diff.tabs[1];

    setDiffTabSide(secondTab.id, "b", "changed");

    expect(useAppStore.getState().diff.tabs).toEqual([firstTab, { ...secondTab, b: "changed" }]);
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
