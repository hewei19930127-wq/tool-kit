import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { DEFAULT_HOTKEY, DEFAULT_LANGUAGE, useAppStore } from "@/core/store";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(() => Promise.resolve(null)),
  writeText: vi.fn(() => Promise.resolve()),
}));

function memoryBackend(): KV {
  const map = new Map<string, unknown>();
  return {
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
});
