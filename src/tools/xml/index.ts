import { Code2 } from "lucide-react";
import type { Tool } from "@/core/types";
import XmlTool from "./XmlTool";
import { validateXml } from "./xml";

export const xmlTool: Tool = {
  id: "xml",
  nameKey: "tools.xml.name",
  icon: Code2,
  keywordsKey: "tools.xml.keywords",
  component: XmlTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return trimmed.startsWith("<") && validateXml(trimmed).ok;
  },
};
