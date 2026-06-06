import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type ToolResult<T = string> =
  | { ok: true; value: T }
  | { ok: false; error: string; line?: number; col?: number };

export interface ToolContext {
  input: string;
  setInput: (text: string) => void;
}

export interface ToolCommand {
  id: string;
  title: string;
  run: (ctx: ToolContext) => void;
}

export interface Tool {
  id: string;
  name: string;
  icon: LucideIcon;
  keywords: string[];
  component: ComponentType;
  detectClipboard?: (text: string) => boolean;
  commands?: ToolCommand[];
}
