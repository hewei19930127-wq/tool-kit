import { jsonTool } from "@/tools/json";
import type { Tool } from "./types";

export const tools: Tool[] = [jsonTool];

export function getTool(id: string | null): Tool | undefined {
  return id ? tools.find((tool) => tool.id === id) : undefined;
}
