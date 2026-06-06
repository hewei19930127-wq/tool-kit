import type { ToolResult } from "@/core/types";
import { formatJson, minifyJson, sortJsonKeys } from "@/tools/json/json";
import { formatXml, minifyXml } from "@/tools/xml/xml";

export interface TransformOpts {
  indent?: number;
}

export type TransformFn = (input: string, opts?: TransformOpts) => ToolResult;

export const TRANSFORMS: Record<string, TransformFn> = {
  "json.format": (input, opts) => formatJson(input, opts?.indent ?? 2),
  "json.minify": (input) => minifyJson(input),
  "json.sortKeys": (input, opts) => sortJsonKeys(input, opts?.indent ?? 2),
  "xml.format": (input, opts) => formatXml(input, opts?.indent ?? 2),
  "xml.minify": (input) => minifyXml(input),
};
