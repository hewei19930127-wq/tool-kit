import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { useAppStore } from "@/core/store";
import Base64Tool from "./Base64Tool";

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

describe("Base64Tool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("encodes input live", () => {
    render(<Base64Tool />);
    fireEvent.change(screen.getByLabelText("Base64 input"), {
      target: { value: "hi" },
    });
    expect(screen.getByLabelText("Output").textContent).toContain("aGk=");
  });

  it("shows an error when decoding garbage", () => {
    render(<Base64Tool />);
    fireEvent.click(screen.getByRole("button", { name: "decode" }));
    fireEvent.change(screen.getByLabelText("Base64 input"), {
      target: { value: "!!!" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
