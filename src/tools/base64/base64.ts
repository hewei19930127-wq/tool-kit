import { toMessage } from "@/core/result";
import type { ToolResult } from "@/core/types";

function toUrlSafe(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlSafe(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  return base64;
}

export function encodeBase64(input: string, urlSafe = false): ToolResult {
  try {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);
    return { ok: true, value: urlSafe ? toUrlSafe(base64) : base64 };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export function decodeBase64(input: string, urlSafe = false): ToolResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Input is empty" };

  try {
    const normalized = urlSafe ? fromUrlSafe(trimmed) : trimmed;
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return {
      ok: true,
      value: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return { ok: false, error: "Invalid Base64 input" };
  }
}
