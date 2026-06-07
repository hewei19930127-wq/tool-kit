import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { I18nKey, I18nParams } from "@/core/i18n/types";

export type ToolResult<T = string> =
  | { ok: true; value: T; valueKey?: I18nKey; params?: I18nParams }
  | {
      ok: false;
      error: string;
      errorKey?: I18nKey;
      params?: I18nParams;
      line?: number;
      col?: number;
    };

export interface ToolContext {
  input: string;
  setInput: (text: string) => void;
}

export interface ToolCommand {
  id: string;
  titleKey: I18nKey;
  run: (ctx: ToolContext) => void;
}

export interface Tool {
  id: string;
  nameKey: I18nKey;
  icon: LucideIcon;
  keywordsKey: I18nKey;
  component: ComponentType;
  detectClipboard?: (text: string) => boolean;
  commands?: ToolCommand[];
}
