/**
 * Single source of truth for detecting the native Tauri shell vs. the browser.
 * Every native-boundary service (storage, clipboard, …) routes through this so
 * the detection sentinel lives in exactly one place.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Reflect.has(window, "__TAURI_INTERNALS__");
}
