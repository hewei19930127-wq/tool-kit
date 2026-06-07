import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeClipboardText } from "./clipboard";

const { writeTauriTextMock } = vi.hoisted(() => ({
  writeTauriTextMock: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: writeTauriTextMock,
}));

const originalClipboard = navigator.clipboard;

function setClipboard(clipboard: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
}

function setTauriRuntime(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  } else {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  }
}

describe("writeClipboardText", () => {
  beforeEach(() => {
    writeTauriTextMock.mockReset();
    setClipboard(undefined);
    setTauriRuntime(false);
  });

  afterEach(() => {
    setClipboard(originalClipboard);
    setTauriRuntime(false);
  });

  it("writes through the Tauri clipboard first", async () => {
    const browserWriteText = vi.fn<(text: string) => Promise<void>>();
    writeTauriTextMock.mockResolvedValueOnce(undefined);
    setClipboard({ writeText: browserWriteText });
    setTauriRuntime(true);

    await writeClipboardText("formatted json");

    expect(writeTauriTextMock).toHaveBeenCalledWith("formatted json");
    expect(browserWriteText).not.toHaveBeenCalled();
  });

  it("falls back to the browser clipboard when Tauri is unavailable", async () => {
    const browserWriteText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    writeTauriTextMock.mockRejectedValueOnce(new Error("not in Tauri"));
    setClipboard({ writeText: browserWriteText });
    setTauriRuntime(true);

    await writeClipboardText("formatted json");

    expect(writeTauriTextMock).toHaveBeenCalledWith("formatted json");
    expect(browserWriteText).toHaveBeenCalledWith("formatted json");
  });

  it("rejects when neither clipboard path can write", async () => {
    const tauriError = new Error("clipboard denied");
    writeTauriTextMock.mockRejectedValueOnce(tauriError);
    setTauriRuntime(true);

    await expect(writeClipboardText("formatted json")).rejects.toThrow("clipboard denied");
  });

  it("uses the browser clipboard first outside Tauri", async () => {
    const browserWriteText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    setClipboard({ writeText: browserWriteText });

    await writeClipboardText("formatted json");

    expect(browserWriteText).toHaveBeenCalledWith("formatted json");
    expect(writeTauriTextMock).not.toHaveBeenCalled();
  });
});
