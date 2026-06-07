import { Regex } from "lucide-react";
import type { Tool } from "@/core/types";
import RegexTool from "./RegexTool";

export const regexTool: Tool = {
  id: "regex",
  nameKey: "tools.regex.name",
  icon: Regex,
  keywordsKey: "tools.regex.keywords",
  component: RegexTool,
};
