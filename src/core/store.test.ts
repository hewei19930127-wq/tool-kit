import { beforeEach, describe, expect, it } from "vitest";
import { DEEPSEEK_ENDPOINT, OPENAI_ENDPOINT } from "@/tools/translate/translate";
import {
  DEFAULT_LANGUAGE,
  makeDefaultDiffSlice,
  makeDefaultTextTabsState,
  makeDefaultTranslateSlice,
  normalizeTranslateSlice,
  useAppStore,
} from "./store";

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
      textTabs: makeDefaultTextTabsState(),
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

  it("reorders favorites before or after a target", () => {
    useAppStore.setState({ favorites: ["json", "base64", "url", "time"] });
    const { reorderFavorites } = useAppStore.getState();

    // Drop "time" before "base64".
    reorderFavorites("time", "base64", false);
    expect(useAppStore.getState().favorites).toEqual(["json", "time", "base64", "url"]);

    // Drop "json" after "url" (reaching the end of the list).
    reorderFavorites("json", "url", true);
    expect(useAppStore.getState().favorites).toEqual(["time", "base64", "url", "json"]);
  });

  it("ignores no-op or invalid favorite reorders", () => {
    useAppStore.setState({ favorites: ["json", "base64"] });
    const initial = useAppStore.getState().favorites;
    const { reorderFavorites } = useAppStore.getState();

    reorderFavorites("json", "json", false); // same source and target
    reorderFavorites("json", "base64", false); // already before "base64"
    reorderFavorites("xml", "json", true); // source not pinned
    reorderFavorites("json", "xml", true); // target not pinned

    expect(useAppStore.getState().favorites).toBe(initial);
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

  it("adds a text tab and activates it", () => {
    const firstTab = useAppStore.getState().textTabs.json.tabs[0];
    useAppStore.getState().addTextTab("json");

    const { activeTabId, nextSeq, tabs } = useAppStore.getState().textTabs.json;
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toBe(firstTab);
    expect(tabs[1]).toMatchObject({ seq: 2, input: "" });
    expect(activeTabId).toBe(tabs[1].id);
    expect(nextSeq).toBe(3);
  });

  it("updates only the requested text tab and tool", () => {
    const { addTextTab, setTextTabInput } = useAppStore.getState();
    addTextTab("json");
    addTextTab("xml");
    const jsonTab = useAppStore.getState().textTabs.json.tabs[1];
    const xmlBefore = useAppStore.getState().textTabs.xml;

    setTextTabInput("json", jsonTab.id, '{"a":1}');

    expect(useAppStore.getState().textTabs.json.tabs[1]).toEqual({
      ...jsonTab,
      input: '{"a":1}',
    });
    expect(useAppStore.getState().textTabs.xml).toBe(xmlBefore);
  });

  it("closes text tabs and restarts numbering when one remains", () => {
    const { addTextTab, closeTextTab } = useAppStore.getState();
    addTextTab("xml");
    const [firstTab, secondTab] = useAppStore.getState().textTabs.xml.tabs;

    closeTextTab("xml", firstTab.id);

    const { tabs, activeTabId, nextSeq } = useAppStore.getState().textTabs.xml;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(secondTab.id);
    expect(tabs[0].seq).toBe(1);
    expect(activeTabId).toBe(secondTab.id);
    expect(nextSeq).toBe(2);

    closeTextTab("xml", secondTab.id);
    expect(useAppStore.getState().textTabs.xml.tabs).toHaveLength(1);
  });

  it("renames text tabs and clears the name when blank", () => {
    const { renameTextTab } = useAppStore.getState();
    const tab = useAppStore.getState().textTabs.json.tabs[0];

    renameTextTab("json", tab.id, "  Payload  ");
    expect(useAppStore.getState().textTabs.json.tabs[0].name).toBe("Payload");

    renameTextTab("json", tab.id, " ");
    expect(useAppStore.getState().textTabs.json.tabs[0].name).toBeUndefined();
  });

  it("repairs stale text tabs during hydration", () => {
    useAppStore.getState().hydrate({
      textTabs: {
        json: {
          tabs: [{ id: "json-one", seq: 1, input: "{}" }],
          activeTabId: "missing",
          nextSeq: 1,
        },
      },
    });

    expect(useAppStore.getState().textTabs.json).toEqual({
      tabs: [{ id: "json-one", seq: 1, input: "{}" }],
      activeTabId: "json-one",
      nextSeq: 2,
    });
    expect(useAppStore.getState().textTabs.xml.tabs).toHaveLength(1);
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

describe("translate slice", () => {
  beforeEach(() => {
    useAppStore.setState({ translate: makeDefaultTranslateSlice() });
  });

  it("returns defaults for garbage persisted values", () => {
    expect(normalizeTranslateSlice(null)).toEqual(makeDefaultTranslateSlice());
    expect(normalizeTranslateSlice("nonsense")).toEqual(makeDefaultTranslateSlice());
  });

  it("falls back unknown language, style, and provider values", () => {
    const slice = normalizeTranslateSlice({
      source: "xx",
      target: "auto",
      style: "shakespeare",
      provider: "bing",
    });
    expect(slice.source).toBe("auto");
    expect(slice.target).toBe("en");
    expect(slice.style).toBe("general");
    expect(slice.provider).toBe("deepseek");
  });

  it("resets preset endpoints and invalid models while preserving keys", () => {
    const slice = normalizeTranslateSlice({
      providers: {
        deepseek: {
          apiKey: "k1",
          model: "deepseek-v3",
          endpointUrl: "https://evil.example.com",
        },
        openai: {
          apiKey: "k2",
          model: "",
          endpointUrl: "http://other.example.com",
        },
        custom: {
          apiKey: "",
          model: "llama3.3",
          endpointUrl: "http://localhost:11434/v1/chat/completions",
        },
      },
    });
    expect(slice.providers.deepseek).toEqual({
      apiKey: "k1",
      model: "deepseek-v4-flash",
      endpointUrl: DEEPSEEK_ENDPOINT,
    });
    expect(slice.providers.openai).toEqual({
      apiKey: "k2",
      model: "gpt-5.2",
      endpointUrl: OPENAI_ENDPOINT,
    });
    expect(slice.providers.custom).toEqual({
      apiKey: "",
      model: "llama3.3",
      endpointUrl: "http://localhost:11434/v1/chat/completions",
    });
  });

  it("hydrates the translate slice through the store", () => {
    useAppStore.getState().hydrate({ translate: { target: "ja" } });
    expect(useAppStore.getState().translate.target).toBe("ja");
    expect(useAppStore.getState().translate.provider).toBe("deepseek");
  });

  it("updates languages, style, provider, and per-provider config", () => {
    const state = useAppStore.getState();
    state.setTranslateLanguages("en", "zh-Hans");
    state.setTranslateStyle("polish");
    state.setTranslateProvider("custom");
    state.setTranslateProviderConfig("custom", { model: "llama3.3" });
    const translate = useAppStore.getState().translate;
    expect(translate.source).toBe("en");
    expect(translate.target).toBe("zh-Hans");
    expect(translate.style).toBe("polish");
    expect(translate.provider).toBe("custom");
    expect(translate.providers.custom.model).toBe("llama3.3");
  });
});
