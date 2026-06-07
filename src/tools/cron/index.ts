import { CalendarClock } from "lucide-react";
import type { Tool } from "@/core/types";
import CronTool from "./CronTool";
import { describeCron } from "./cron";

export const cronTool: Tool = {
  id: "cron",
  nameKey: "tools.cron.name",
  icon: CalendarClock,
  keywordsKey: "tools.cron.keywords",
  component: CronTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return trimmed.split(/\s+/).length >= 5 && describeCron(trimmed).ok;
  },
};
