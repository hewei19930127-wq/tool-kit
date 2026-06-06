import { Braces } from "lucide-react";
import type { Tool } from "@/core/types";
import JsonTool from "./JsonTool";
import { formatJson } from "./json";

export const jsonTool: Tool = {
  id: "json",
  name: "JSON",
  category: "encode-text",
  icon: Braces,
  keywords: ["json", "format", "pretty", "minify", "validate", "格式化"],
  component: JsonTool,
  detectClipboard(text: string) {
    return formatJson(text).ok;
  },
};
