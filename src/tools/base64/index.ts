import { Binary } from "lucide-react";
import type { Tool } from "@/core/types";
import { decodeBase64 } from "./base64";
import Base64Tool from "./Base64Tool";

export const base64Tool: Tool = {
  id: "base64",
  name: "Base64",
  category: "encode-text",
  icon: Binary,
  keywords: ["base64", "encode", "decode", "atob", "btoa", "编码"],
  component: Base64Tool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    if (/^\d{10}$/.test(trimmed) || /^\d{13}$/.test(trimmed)) return false;
    return (
      trimmed.length >= 8 &&
      /^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed) &&
      (decodeBase64(trimmed).ok || decodeBase64(trimmed, true).ok)
    );
  },
};
