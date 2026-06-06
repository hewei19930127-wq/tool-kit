import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/core/store";
import DiffTool from "./DiffTool";

describe("DiffTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("highlights an added word in inline mode", () => {
    render(<DiffTool />);
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
});
