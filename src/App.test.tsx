import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { type KV, setStorageBackend } from "@/core/services/storage";
import {
  DEFAULT_HOTKEY,
  DEFAULT_LANGUAGE,
  type DiffSlice,
  makeDefaultDiffSlice,
  useAppStore,
} from "@/core/store";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(() => Promise.resolve(null)),
  writeText: vi.fn(() => Promise.resolve()),
}));

function memoryBackend(
  initial: Record<string, unknown> = {},
): KV & { values: Map<string, unknown> } {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    values: map,
    async get<T>(key: string) {
      return map.has(key) ? (map.get(key) as T) : null;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
  };
}

describe("App", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    useAppStore.setState({
      activeToolId: "json",
      favorites: [],
      theme: "system",
      language: DEFAULT_LANGUAGE,
      hotkey: DEFAULT_HOTKEY,
      toolInputs: {},
      diff: makeDefaultDiffSlice(),
    });
  });

  it("closes settings when selecting the active tool from the sidebar", async () => {
    render(<App />);

    await screen.findByText("ToolKit");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "JSON" })).toBeInTheDocument();
  });

  it("switches visible settings labels to Simplified Chinese", async () => {
    render(<App />);

    await screen.findByText("ToolKit");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Simplified Chinese" }));

    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simplified Chinese" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("hydrates and persists diff state", async () => {
    const persistedDiff: DiffSlice = {
      tabs: [
        { id: "one", seq: 1, a: "left", b: "right" },
        { id: "two", seq: 2, a: "old", b: "new" },
      ],
      activeTabId: "two",
      nextSeq: 3,
      mode: "char",
      view: "inline",
    };
    const backend = memoryBackend({ diff: persistedDiff });
    setStorageBackend(backend);

    render(<App />);

    await screen.findByText("ToolKit");
    expect(useAppStore.getState().diff).toEqual(persistedDiff);

    act(() => {
      useAppStore.getState().setDiffView("split");
    });

    await waitFor(() =>
      expect(backend.values.get("diff")).toEqual({
        ...persistedDiff,
        view: "split",
      }),
    );
  });

  it("renders favorites in their curated order and reorders them by pointer drag", async () => {
    // Curated order is the reverse of the registry order (JSON precedes Base64).
    setStorageBackend(memoryBackend({ favorites: ["base64", "json"] }));

    render(<App />);
    await screen.findByText("ToolKit");

    const rowOf = (name: string) =>
      screen.getByRole("button", { name }).closest(".group") as HTMLElement;

    // Favorites follow the curated order, not the registry order.
    const base64Row = rowOf("Base64");
    const jsonRow = rowOf("JSON");
    expect(
      base64Row.compareDocumentPosition(jsonRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // jsdom has no layout, so give the rows stacked boxes to resolve against.
    const stub = (top: number) => vi.fn(() => ({ top, height: 20, bottom: top + 20 }) as DOMRect);
    base64Row.getBoundingClientRect = stub(0);
    jsonRow.getBoundingClientRect = stub(20);

    // Grab JSON's handle and move above Base64's midpoint to drop it first.
    const dispatch = (target: EventTarget, type: string, init: MouseEventInit = {}) =>
      act(() => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
      });

    dispatch(screen.getByRole("button", { name: "Reorder JSON" }), "pointerdown", { button: 0 });
    dispatch(document, "pointermove", { clientY: 2 });
    dispatch(document, "pointerup");

    expect(useAppStore.getState().favorites).toEqual(["json", "base64"]);
  });
});
