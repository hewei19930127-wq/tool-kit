import { Binary } from "lucide-react";
import type { Tool } from "@/core/types";
import Base64Tool from "./Base64Tool";
import { decodeBase64 } from "./base64";

export const base64Tool: Tool = {
  id: "base64",
  nameKey: "tools.base64.name",
  icon: Binary,
  keywordsKey: "tools.base64.keywords",
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
