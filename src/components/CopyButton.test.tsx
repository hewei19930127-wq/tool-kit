import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

const { writeClipboardTextMock } = vi.hoisted(() => ({
  writeClipboardTextMock: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("@/core/services/clipboard", () => ({
  writeClipboardText: writeClipboardTextMock,
}));

describe("CopyButton", () => {
  beforeEach(() => {
    writeClipboardTextMock.mockReset();
  });

  it("copies text and shows a copied state", async () => {
    const onCopied = vi.fn();
    writeClipboardTextMock.mockResolvedValueOnce(undefined);

    render(<CopyButton text="formatted json" onCopied={onCopied} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));

    expect(writeClipboardTextMock).toHaveBeenCalledWith("formatted json");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    expect(onCopied).toHaveBeenCalledOnce();
  });

  it("shows a failure state when the clipboard write fails", async () => {
    const onCopied = vi.fn();
    writeClipboardTextMock.mockRejectedValueOnce(new Error("clipboard denied"));

    render(<CopyButton text="formatted json" onCopied={onCopied} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));

    expect(await screen.findByText("Copy failed")).toBeInTheDocument();
    expect(onCopied).not.toHaveBeenCalled();
  });

  it("does not try to copy an empty value", () => {
    render(<CopyButton text="" />);
    const button = screen.getByRole("button", { name: "Copy output" });

    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(writeClipboardTextMock).not.toHaveBeenCalled();
  });
});
