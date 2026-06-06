import { Braces } from "lucide-react";
import type { Tool } from "@/core/types";
import JsonTool from "./JsonTool";
import { escapeJson, formatJson, unescapeJson } from "./json";

export const jsonTool: Tool = {
  id: "json",
  name: "JSON",
  icon: Braces,
  keywords: [
    "json",
    "format",
    "pretty",
    "minify",
    "validate",
    "escape",
    "格式化",
  ],
  component: JsonTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return /^[{\[]/.test(trimmed) && formatJson(trimmed).ok;
  },
  commands: [
    {
      id: "escape",
      title: "Escape to JSON string",
      run: (ctx) => {
        const result = escapeJson(ctx.input);
        if (result.ok) ctx.setInput(result.value);
      },
    },
    {
      id: "unescape",
      title: "Unescape JSON string",
      run: (ctx) => {
        const result = unescapeJson(ctx.input);
        if (result.ok) ctx.setInput(result.value);
      },
    },
  ],
};
