import { base64Tool } from "@/tools/base64";
import { colorTool } from "@/tools/color";
import { cronTool } from "@/tools/cron";
import { diffTool } from "@/tools/diff";
import { jsonTool } from "@/tools/json";
import { radixTool } from "@/tools/radix";
import { regexTool } from "@/tools/regex";
import { timeTool } from "@/tools/time";
import { urlTool } from "@/tools/url";
import { xmlTool } from "@/tools/xml";
import type { Tool } from "./types";

export const tools: Tool[] = [
  jsonTool,
  base64Tool,
  urlTool,
  timeTool,
  diffTool,
  xmlTool,
  radixTool,
  cronTool,
  regexTool,
  colorTool,
];

export function getTool(id: string | null): Tool | undefined {
  return id ? tools.find((tool) => tool.id === id) : undefined;
}
