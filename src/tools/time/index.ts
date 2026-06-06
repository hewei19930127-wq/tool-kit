import { Clock } from "lucide-react";
import type { Tool } from "@/core/types";
import { toIso } from "./time";
import TimeTool from "./TimeTool";

export const timeTool: Tool = {
  id: "time",
  name: "Time",
  icon: Clock,
  keywords: ["time", "timestamp", "epoch", "unix", "iso", "timezone", "时间"],
  component: TimeTool,
  detectClipboard(text: string) {
    const trimmed = text.trim();
    return (/^\d{10}$/.test(trimmed) || /^\d{13}$/.test(trimmed)) && toIso(trimmed).ok;
  },
};
