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
});
