import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDefaultDiffSlice, useAppStore } from "@/core/store";
import DiffTool from "./DiffTool";

describe("DiffTool", () => {
  beforeEach(() => {
    useAppStore.setState({
      language: "en",
      toolInputs: {},
      diff: makeDefaultDiffSlice(),
    });
  });

  it("renders the split view by default", () => {
    render(<DiffTool />);

    expect(screen.getByLabelText("Split diff")).toBeInTheDocument();
    expect(screen.queryByLabelText("Inline diff")).not.toBeInTheDocument();
  });

  it("highlights an added word in inline mode", () => {
    render(<DiffTool />);
    fireEvent.click(screen.getByRole("button", { name: "Inline" }));
    fireEvent.change(screen.getByLabelText("Original (A)"), {
      target: { value: "hello world" },
    });
    fireEvent.change(screen.getByLabelText("Changed (B)"), {
      target: { value: "hello brave world" },
    });
    const added = screen.getByLabelText("Inline diff").querySelector("ins");
    expect(added?.textContent).toContain("brave");
  });

  it("reports added and removed counts", () => {
    render(<DiffTool />);
    fireEvent.change(screen.getByLabelText("Original (A)"), {
      target: { value: "a\nb\n" },
    });
    fireEvent.change(screen.getByLabelText("Changed (B)"), {
      target: { value: "a\nc\n" },
    });
    expect(screen.getByLabelText("Diff stats").textContent).toMatch(/\+1/);
  });

  it("switches editor content and output between comparison tabs", () => {
    render(<DiffTool />);
    fireEvent.click(screen.getByRole("button", { name: "Inline" }));

    fireEvent.change(screen.getByLabelText("Original (A)"), {
      target: { value: "first" },
    });
    fireEvent.change(screen.getByLabelText("Changed (B)"), {
      target: { value: "first changed" },
    });
    expect(screen.getByLabelText("Inline diff").textContent).toContain("first changed");

    fireEvent.click(screen.getByLabelText("New comparison"));
    expect(screen.getByLabelText("Original (A)")).toHaveValue("");
    expect(screen.getByLabelText("Changed (B)")).toHaveValue("");
    expect(screen.getByLabelText("Inline diff").textContent).not.toContain("first changed");

    fireEvent.change(screen.getByLabelText("Original (A)"), {
      target: { value: "second" },
    });
    fireEvent.change(screen.getByLabelText("Changed (B)"), {
      target: { value: "second changed" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "Diff 1" }));
    expect(screen.getByLabelText("Original (A)")).toHaveValue("first");
    expect(screen.getByLabelText("Changed (B)")).toHaveValue("first changed");
    expect(screen.getByLabelText("Inline diff").textContent).toContain("first changed");

    fireEvent.click(screen.getByRole("tab", { name: "Diff 2" }));
    expect(screen.getByLabelText("Original (A)")).toHaveValue("second");
    expect(screen.getByLabelText("Changed (B)")).toHaveValue("second changed");
    expect(screen.getByLabelText("Inline diff").textContent).toContain("second changed");
  });

  it("opens a new tab with Cmd+T and switches tabs with Cmd+number", () => {
    render(<DiffTool />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);

    fireEvent.keyDown(window, { key: "t", metaKey: true });
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Diff 2" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "1", metaKey: true });
    expect(screen.getByRole("tab", { name: "Diff 1" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "2", metaKey: true });
    expect(screen.getByRole("tab", { name: "Diff 2" })).toHaveAttribute("aria-selected", "true");
  });

  it("leaves Cmd+K to the global command palette and does not add a tab", () => {
    render(<DiffTool />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });
});
