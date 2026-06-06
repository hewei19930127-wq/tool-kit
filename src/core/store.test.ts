import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store";

describe("app store", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeToolId: null,
      favorites: [],
      theme: "system",
      toolInputs: {},
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
    useAppStore.getState().hydrate({ favorites: ["base64"], theme: "dark" });
    expect(useAppStore.getState().favorites).toEqual(["base64"]);
    expect(useAppStore.getState().theme).toBe("dark");
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
});
