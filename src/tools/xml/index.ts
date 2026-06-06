import { Code2 } from "lucide-react";
import type { Tool } from "@/core/types";
import XmlTool from "./XmlTool";
import { validateXml } from "./xml";

export const xmlTool: Tool = {
  id: "xml",
  name: "XML",
  icon: Code2,
  keywords: ["xml", "format", "pretty", "minify", "validate", "格式化"],
  component: XmlTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return trimmed.startsWith("<") && validateXml(trimmed).ok;
  },
};
