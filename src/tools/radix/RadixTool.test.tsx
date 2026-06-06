import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/core/store";
import RadixTool from "./RadixTool";

describe("RadixTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("shows all bases for a decimal input", () => {
    render(<RadixTool />);
    fireEvent.change(screen.getByLabelText("Number input"), {
      target: { value: "255" },
    });
    expect(screen.getByLabelText("Hexadecimal").textContent).toContain("ff");
    expect(screen.getByLabelText("Binary").textContent).toContain("11111111");
  });

  it("reports invalid digits", () => {
    render(<RadixTool />);
    fireEvent.change(screen.getByLabelText("Number input"), {
      target: { value: "zz" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
