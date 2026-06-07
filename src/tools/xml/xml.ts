import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import type { ToolResult } from "@/core/types";

const XML_OPTIONS = {
  ignoreAttributes: false,
  preserveOrder: true,
  commentPropName: "#comment",
  cdataPropName: "#cdata",
  parseTagValue: false,
} as const;

function checkXml(input: string): ToolResult {
  if (!input.trim()) {
    return { ok: false, error: "Input is empty", errorKey: "common.errors.inputEmpty" };
  }

  const validation = XMLValidator.validate(input, {
    allowBooleanAttributes: true,
  });

  if (validation === true) {
    return { ok: true, value: "Well-formed", valueKey: "tools.xml.messages.wellFormed" };
  }

  return {
    ok: false,
    error: validation.err.msg,
    line: validation.err.line,
    col: validation.err.col,
  };
}

export function validateXml(input: string): ToolResult {
  return checkXml(input);
}

export function formatXml(input: string, indent = 2): ToolResult {
  const validation = checkXml(input);
  if (!validation.ok) return validation;

  const parsed = new XMLParser(XML_OPTIONS).parse(input);
  const output = new XMLBuilder({
    ...XML_OPTIONS,
    format: true,
    indentBy: " ".repeat(indent),
  }).build(parsed);

  return { ok: true, value: String(output).replace(/\n+$/, "") };
}

export function minifyXml(input: string): ToolResult {
  const validation = checkXml(input);
  if (!validation.ok) return validation;

  const parsed = new XMLParser(XML_OPTIONS).parse(input);
  const output = new XMLBuilder({ ...XML_OPTIONS, format: false }).build(parsed);

  return {
    ok: true,
    value: String(output).replace(/\s+</g, "<").replace(/>\s+/g, ">").trim(),
  };
}
