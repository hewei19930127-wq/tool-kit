import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { setStorageBackend, type KV } from "@/core/services/storage";
import { useAppStore } from "@/core/store";
import JsonTool from "./JsonTool";

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

describe("JsonTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("formats input on Format", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"b":1,"a":2}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByLabelText("Output").textContent).toContain('"b": 1');
  });

  it("shows an error state for invalid JSON", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("validates input without rewriting it", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByLabelText("Output").textContent).toContain("Valid JSON");
    expect(input.value).toBe('{"a":1}');
  });

  it("escapes and unescapes JSON string literals", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: 'he said "hi"\n' } });
    fireEvent.click(screen.getByRole("button", { name: "Escape" }));
    expect(screen.getByLabelText("Output").textContent).toBe(
      '"he said \\"hi\\"\\n"',
    );

    fireEvent.change(input, { target: { value: '"he said \\"hi\\"\\n"' } });
    fireEvent.click(screen.getByRole("button", { name: "Unescape" }));
    expect(screen.getByLabelText("Output").textContent).toBe('he said "hi"\n');
  });
});
