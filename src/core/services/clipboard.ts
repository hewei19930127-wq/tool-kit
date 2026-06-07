import { writeText as writeTauriText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauriRuntime } from "./runtime";

async function writeBrowserText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Browser clipboard is unavailable");
  }

  await navigator.clipboard.writeText(text);
}

export async function writeClipboardText(text: string): Promise<void> {
  if (!isTauriRuntime()) {
    await writeBrowserText(text);
    return;
  }

  try {
    await writeTauriText(text);
  } catch (tauriError) {
    try {
      await writeBrowserText(text);
    } catch {
      // Surface the original Tauri error: it usually carries the
      // permission/runtime context that explains why the native write failed.
      throw tauriError;
    }
  }
}
