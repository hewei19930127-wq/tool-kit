import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { makeDefaultTextTabsState, useAppStore } from "@/core/store";
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
    useAppStore.setState({ toolInputs: {}, textTabs: makeDefaultTextTabsState(), wrap: true });
  });

  it("formats input on Format", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"b":1,"a":2}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect((await screen.findByLabelText("Output")).textContent).toContain('"b": 1');
  });

  it("keeps independent input and output between JSON tabs", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: '{"first":1}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect((await screen.findByLabelText("Output")).textContent).toContain('"first": 1');

    fireEvent.click(screen.getByLabelText("New JSON tab"));
    expect(screen.getByLabelText("JSON input")).toHaveValue("");
    expect(
      screen.getByText("Output appears here. Paste JSON and pick an action."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: '{"second":2}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect((await screen.findByLabelText("Output")).textContent).toContain('"second": 2');

    fireEvent.click(screen.getByRole("tab", { name: "JSON 1" }));
    expect(screen.getByLabelText("JSON input")).toHaveValue('{"first":1}');
    expect(screen.getByLabelText("Output").textContent).toContain('"first": 1');

    fireEvent.click(screen.getByRole("tab", { name: "JSON 2" }));
    expect(screen.getByLabelText("JSON input")).toHaveValue('{"second":2}');
    expect(screen.getByLabelText("Output").textContent).toContain('"second": 2');
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

  it("toggles word wrap on the output pane", async () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    const output = await screen.findByLabelText("Output");
    expect(output.className).toContain("whitespace-pre-wrap");

    fireEvent.click(screen.getByRole("button", { name: "Toggle word wrap" }));
    expect(output.className).toContain("whitespace-pre");
    expect(output.className).not.toContain("whitespace-pre-wrap");
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
