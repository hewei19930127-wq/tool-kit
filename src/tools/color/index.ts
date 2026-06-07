import { Palette } from "lucide-react";
import type { Tool } from "@/core/types";
import ColorTool from "./ColorTool";
import { parseColor } from "./color";

export const colorTool: Tool = {
  id: "color",
  nameKey: "tools.color.name",
  icon: Palette,
  keywordsKey: "tools.color.keywords",
  component: ColorTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return parseColor(trimmed).ok && /^#|rgb|hsl/i.test(trimmed);
  },
};
