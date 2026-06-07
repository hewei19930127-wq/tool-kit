import { writeText as writeTauriText } from "@tauri-apps/plugin-clipboard-manager";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Reflect.has(window, "__TAURI_INTERNALS__");
}

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
    return;
  } catch (tauriError) {
    try {
      await writeBrowserText(text);
      return;
    } catch {
      // Prefer the original Tauri error because it usually carries the
      // permission/runtime context that explains why the native write failed.
    }

    throw tauriError;
  }
}
