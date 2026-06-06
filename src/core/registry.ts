import { base64Tool } from "@/tools/base64";
import { diffTool } from "@/tools/diff";
import { jsonTool } from "@/tools/json";
import { timeTool } from "@/tools/time";
import { urlTool } from "@/tools/url";
import type { Tool } from "./types";

export const tools: Tool[] = [
  jsonTool,
  base64Tool,
  urlTool,
  timeTool,
  diffTool,
];

export function getTool(id: string | null): Tool | undefined {
  return id ? tools.find((tool) => tool.id === id) : undefined;
}
