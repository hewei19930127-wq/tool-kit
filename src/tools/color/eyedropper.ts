import { invoke } from "@tauri-apps/api/core";

/** Try the web EyeDropper first; fall back to the native Tauri command. */
export async function pickColor(): Promise<string | null> {
  const EyeDropperCtor = (
    globalThis as {
      EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
    }
  ).EyeDropper;

  if (EyeDropperCtor) {
    try {
      const { sRGBHex } = await new EyeDropperCtor().open();
      return sRGBHex;
    } catch {
      return null;
    }
  }

  try {
    return await invoke<string>("pick_color");
  } catch {
    return null;
  }
}
