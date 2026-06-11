import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
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

  it("formats input on Format", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"b":1,"a":2}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect((await screen.findByLabelText("Output")).textContent).toContain('"b": 1');
  });

  it("shows an error state for invalid JSON", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("validates input without rewriting it", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByLabelText("Output").textContent).toContain("Valid JSON");
    expect(input.value).toBe('{"a":1}');
  });

  it("finds and cycles output matches with Cmd+F", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"alpha":1,"beta":"alpha"}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    const output = await screen.findByLabelText("Output");

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    const finder = screen.getByLabelText("Find in output");
    fireEvent.change(finder, { target: { value: "alpha" } });

    expect(output.querySelectorAll("mark")).toHaveLength(2);
    expect(output.querySelectorAll("mark[data-search-active]")).toHaveLength(1);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    fireEvent.keyDown(finder, { key: "Enter" });
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    fireEvent.keyDown(finder, { key: "Enter" });
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    fireEvent.keyDown(finder, { key: "Enter", shiftKey: true });
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
  });

  it("closes the find bar with Escape and clears highlights", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"alpha":1}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    const output = await screen.findByLabelText("Output");

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    const finder = screen.getByLabelText("Find in output");
    fireEvent.change(finder, { target: { value: "alpha" } });
    expect(output.querySelectorAll("mark")).toHaveLength(1);

    fireEvent.keyDown(finder, { key: "Escape" });
    expect(screen.queryByLabelText("Find in output")).not.toBeInTheDocument();
    expect(output.querySelectorAll("mark")).toHaveLength(0);
  });

  it("escapes and unescapes JSON string literals", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: 'he said "hi"\n' } });
    fireEvent.click(screen.getByRole("button", { name: "Escape" }));
    expect(screen.getByLabelText("Output").textContent).toBe('"he said \\"hi\\"\\n"');

    fireEvent.change(input, { target: { value: '"he said \\"hi\\"\\n"' } });
    fireEvent.click(screen.getByRole("button", { name: "Unescape" }));
    expect(screen.getByLabelText("Output").textContent).toBe('he said "hi"\n');
  });
});
