import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { setStorageBackend, type KV } from "@/core/services/storage";
import { useAppStore } from "@/core/store";
import TimeTool from "./TimeTool";

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

describe("TimeTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("renders ISO for an epoch input", () => {
    render(<TimeTool />);
    fireEvent.change(screen.getByLabelText("Time input"), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText("ISO 8601").textContent).toContain(
      "1970-01-01T00:00:00.000Z",
    );
  });

  it("fills the current time on Now", () => {
    render(<TimeTool />);
    fireEvent.click(screen.getByRole("button", { name: "Now" }));
    expect(
      (screen.getByLabelText("Time input") as HTMLInputElement).value,
    ).not.toBe("");
  });
});
