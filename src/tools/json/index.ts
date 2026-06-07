import { Braces } from "lucide-react";
import type { Tool } from "@/core/types";
import JsonTool from "./JsonTool";
import { escapeJson, formatJson, unescapeJson } from "./json";

export const jsonTool: Tool = {
  id: "json",
  nameKey: "tools.json.name",
  icon: Braces,
  keywordsKey: "tools.json.keywords",
  component: JsonTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return /^[{[]/.test(trimmed) && formatJson(trimmed).ok;
  },
  commands: [
    {
      id: "escape",
      titleKey: "tools.json.commands.escape",
      run: (ctx) => {
        const result = escapeJson(ctx.input);
        if (result.ok) ctx.setInput(result.value);
      },
    },
    {
      id: "unescape",
      titleKey: "tools.json.commands.unescape",
      run: (ctx) => {
        const result = unescapeJson(ctx.input);
        if (result.ok) ctx.setInput(result.value);
      },
    },
  ],
};
