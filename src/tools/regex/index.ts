import { Regex } from "lucide-react";
import type { Tool } from "@/core/types";
import RegexTool from "./RegexTool";

export const regexTool: Tool = {
  id: "regex",
  name: "Regex",
  icon: Regex,
  keywords: ["regex", "regexp", "pattern", "match", "test", "正则"],
  component: RegexTool,
};
