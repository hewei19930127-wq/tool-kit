import { Languages } from "lucide-react";
import type { Tool } from "@/core/types";
import TranslateTool from "./TranslateTool";

export const translateTool: Tool = {
  id: "translate",
  nameKey: "tools.translate.name",
  icon: Languages,
  keywordsKey: "tools.translate.keywords",
  component: TranslateTool,
  // No detectClipboard: any text is "translatable", so a banner would fire on everything.
};
