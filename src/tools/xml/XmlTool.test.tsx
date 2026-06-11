import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { useAppStore } from "@/core/store";
import XmlTool from "./XmlTool";

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

describe("XmlTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("formats valid XML", async () => {
    render(<XmlTool />);
    fireEvent.change(screen.getByLabelText("XML input"), {
      target: { value: "<a><b>1</b></a>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect((await screen.findByLabelText("Output")).textContent).toContain("<b>1</b>");
  });

  it("highlights output matches with Cmd+F", async () => {
    render(<XmlTool />);
    fireEvent.change(screen.getByLabelText("XML input"), {
      target: { value: "<item><item>1</item></item>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    const output = await screen.findByLabelText("Output");

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    fireEvent.change(screen.getByLabelText("Find in output"), { target: { value: "item" } });

    expect(output.querySelectorAll("mark")).toHaveLength(4);
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("shows an error for malformed XML", () => {
    render(<XmlTool />);
    fireEvent.change(screen.getByLabelText("XML input"), {
      target: { value: "<a></b>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
