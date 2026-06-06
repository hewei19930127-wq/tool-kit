import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";

vi.mock("./eyedropper", () => ({
  pickColor: vi.fn().mockResolvedValue("#00ff00"),
}));

import ColorTool from "./ColorTool";

describe("ColorTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("shows conversions for a hex input", () => {
    render(<ColorTool />);
    fireEvent.change(screen.getByLabelText("Color input"), {
      target: { value: "#ff0000" },
    });
    expect(screen.getByLabelText("rgb").textContent).toContain("rgb(255, 0, 0)");
  });

  it("computes a contrast ratio", () => {
    render(<ColorTool />);
    fireEvent.change(screen.getByLabelText("Foreground"), {
      target: { value: "#000000" },
    });
    fireEvent.change(screen.getByLabelText("Background"), {
      target: { value: "#ffffff" },
    });
    expect(screen.getByLabelText("Contrast ratio").textContent).toContain("21");
  });
});
