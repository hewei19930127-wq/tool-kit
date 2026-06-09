import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDefaultDiffSlice, useAppStore } from "@/core/store";
import { DiffTabs } from "./DiffTabs";

describe("DiffTabs", () => {
  beforeEach(() => {
    useAppStore.setState({
      language: "en",
      diff: makeDefaultDiffSlice(),
    });
  });

  it("adds a new comparison tab", () => {
    render(<DiffTabs />);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("New comparison"));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Diff 2" })).toHaveAttribute("aria-selected", "true");
  });

  it("closes a comparison tab", () => {
    useAppStore.getState().addDiffTab();
    render(<DiffTabs />);

    fireEvent.click(screen.getByLabelText("Close comparison Diff 2"));

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Diff 1" })).toHaveAttribute("aria-selected", "true");
  });

  it("hides close controls when only one tab remains", () => {
    render(<DiffTabs />);

    expect(screen.queryByLabelText(/Close comparison/)).not.toBeInTheDocument();
  });

  it("renames a tab via double-click and Enter", () => {
    render(<DiffTabs />);

    fireEvent.doubleClick(screen.getByRole("tab", { name: "Diff 1" }));
    const input = screen.getByLabelText("Rename comparison");
    fireEvent.change(input, { target: { value: "Configs" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("tab", { name: "Configs" })).toBeInTheDocument();
    expect(useAppStore.getState().diff.tabs[0].name).toBe("Configs");
  });

  it("cancels a rename on Escape without changing the label", () => {
    render(<DiffTabs />);

    fireEvent.doubleClick(screen.getByRole("tab", { name: "Diff 1" }));
    const input = screen.getByLabelText("Rename comparison");
    fireEvent.change(input, { target: { value: "Configs" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("tab", { name: "Diff 1" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Configs" })).not.toBeInTheDocument();
    expect(useAppStore.getState().diff.tabs[0].name).toBeUndefined();
  });

  it("renames a tab from the right-click menu", () => {
    render(<DiffTabs />);

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Diff 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename comparison" }));

    const input = screen.getByLabelText("Rename comparison");
    fireEvent.change(input, { target: { value: "Spec" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("tab", { name: "Spec" })).toBeInTheDocument();
  });

  it("closes other tabs from the right-click menu", () => {
    useAppStore.getState().addDiffTab();
    render(<DiffTabs />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Diff 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close others" }));

    // Survivor is renumbered to "Diff 1".
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Diff 1" })).toBeInTheDocument();
  });

  it("closes tabs to the right from the right-click menu", () => {
    useAppStore.getState().addDiffTab();
    useAppStore.getState().addDiffTab();
    render(<DiffTabs />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Diff 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close tabs to the right" }));

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Diff 1" })).toBeInTheDocument();
  });

  it("closes all tabs back to a single Diff 1 from the right-click menu", () => {
    useAppStore.getState().addDiffTab();
    render(<DiffTabs />);

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Diff 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close all" }));

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Diff 1" })).toBeInTheDocument();
  });

  it("dismisses the context menu on Escape", () => {
    render(<DiffTabs />);

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Diff 1" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
