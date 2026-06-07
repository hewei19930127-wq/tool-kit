import { Clock } from "lucide-react";
import type { Tool } from "@/core/types";
import TimeTool from "./TimeTool";
import { toIso } from "./time";

export const timeTool: Tool = {
  id: "time",
  nameKey: "tools.time.name",
  icon: Clock,
  keywordsKey: "tools.time.keywords",
  component: TimeTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return (/^\d{10}$/.test(trimmed) || /^\d{13}$/.test(trimmed)) && toIso(trimmed).ok;
  },
};
