import { Link } from "lucide-react";
import type { Tool } from "@/core/types";
import UrlTool from "./UrlTool";

export const urlTool: Tool = {
  id: "url",
  nameKey: "tools.url.name",
  icon: Link,
  keywordsKey: "tools.url.keywords",
  component: UrlTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /%[0-9A-Fa-f]{2}/.test(trimmed);
  },
};
