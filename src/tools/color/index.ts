import { Palette } from "lucide-react";
import type { Tool } from "@/core/types";
import ColorTool from "./ColorTool";
import { parseColor } from "./color";

export const colorTool: Tool = {
  id: "color",
  name: "Color",
  category: "convert-other",
  icon: Palette,
  keywords: ["color", "colour", "hex", "rgb", "hsl", "contrast", "颜色"],
  component: ColorTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return parseColor(trimmed).ok && /^#|rgb|hsl/i.test(trimmed);
  },
};
