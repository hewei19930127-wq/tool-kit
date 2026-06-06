import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { useAppStore } from "@/core/store";
import UrlTool from "./UrlTool";

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

describe("UrlTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("encodes a component live", () => {
    render(<UrlTool />);
    fireEvent.change(screen.getByLabelText("URL input"), {
      target: { value: "a b" },
    });
    expect(screen.getByLabelText("Output").textContent).toContain("a%20b");
  });

  it("shows query parameters as rows", () => {
    render(<UrlTool />);
    fireEvent.change(screen.getByLabelText("URL input"), {
      target: { value: "https://x.com/p?a=1&b=two" },
    });
    expect(screen.getByText("two")).toBeInTheDocument();
  });
});
