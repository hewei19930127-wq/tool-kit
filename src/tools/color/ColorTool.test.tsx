import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { useAppStore } from "@/core/store";

vi.mock("./eyedropper", () => ({
  pickColor: vi.fn().mockResolvedValue("#00ff00"),
}));

import ColorTool from "./ColorTool";

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

describe("ColorTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

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

  it("disables save when the input is empty or invalid", () => {
    render(<ColorTool />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Color input"), {
      target: { value: "not-a-color" },
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves a color to history and restores it from the swatch", async () => {
    render(<ColorTool />);
    // let useHistory's initial storage load settle before recording
    await act(async () => {});
    const input = screen.getByLabelText("Color input");
    fireEvent.change(input, { target: { value: "#ff0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const swatch = await screen.findByRole("button", { name: "History #ff0000" });

    fireEvent.change(input, { target: { value: "#00ff00" } });
    fireEvent.click(swatch);
    expect(input).toHaveValue("#ff0000");
  });

  it("dedupes history entries across input formats", async () => {
    render(<ColorTool />);
    await act(async () => {});
    const input = screen.getByLabelText("Color input");
    fireEvent.change(input, { target: { value: "#ff0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "History #ff0000" });
    fireEvent.change(input, { target: { value: "rgb(255, 0, 0)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByRole("button", { name: "History #ff0000" })).toHaveLength(1);
  });

  it("fills the input from a palette swatch", () => {
    render(<ColorTool />);
    fireEvent.click(screen.getByRole("button", { name: "red-500" }));
    expect(screen.getByLabelText("Color input")).toHaveValue("#ef4444");
  });

  it("switches between palettes", () => {
    render(<ColorTool />);
    expect(screen.queryByRole("button", { name: "Red 500" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Material" }));
    expect(screen.getByRole("button", { name: "Red 500" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "red-500" })).not.toBeInTheDocument();
  });

  it("collapses the color sets section", () => {
    render(<ColorTool />);
    fireEvent.click(screen.getByRole("button", { name: "Color sets" }));
    expect(screen.queryByRole("button", { name: "red-500" })).not.toBeInTheDocument();
  });
});
