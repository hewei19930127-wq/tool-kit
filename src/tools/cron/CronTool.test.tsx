import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/core/store";
import CronTool from "./CronTool";

describe("CronTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("describes a valid expression", () => {
    render(<CronTool />);
    fireEvent.change(screen.getByLabelText("Cron expression"), {
      target: { value: "*/5 * * * *" },
    });
    expect(
      screen.getByLabelText("Description").textContent?.toLowerCase(),
    ).toContain("every 5 minutes");
  });

  it("shows an error for an invalid expression", () => {
    render(<CronTool />);
    fireEvent.change(screen.getByLabelText("Cron expression"), {
      target: { value: "bogus" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
