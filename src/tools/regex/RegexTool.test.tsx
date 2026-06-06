import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/core/store";
import RegexTool from "./RegexTool";

describe("RegexTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("counts matches against the sample text", () => {
    render(<RegexTool />);
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "\\d+" },
    });
    fireEvent.change(screen.getByLabelText("Sample text"), {
      target: { value: "a1 b22 c333" },
    });
    expect(screen.getByLabelText("Match count").textContent).toContain("3");
  });

  it("reports an invalid pattern", () => {
    render(<RegexTool />);
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "(" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
