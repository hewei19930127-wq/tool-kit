export interface RegexSnippet {
  name: string;
  pattern: string;
  flags: string;
  description: string;
}

export const SNIPPETS: RegexSnippet[] = [
  {
    name: "Email",
    pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+",
    flags: "g",
    description: "Basic email address",
  },
  {
    name: "URL (http/https)",
    pattern: "https?://[\\w.-]+(?:/[\\w./?%&=-]*)?",
    flags: "g",
    description: "Web URL",
  },
  {
    name: "IPv4",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    flags: "g",
    description: "Dotted-quad IP",
  },
  {
    name: "ISO date",
    pattern: "\\d{4}-\\d{2}-\\d{2}",
    flags: "g",
    description: "YYYY-MM-DD",
  },
  {
    name: "Hex color",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: "g",
    description: "#rgb or #rrggbb",
  },
  {
    name: "UUID",
    pattern: "[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}",
    flags: "gi",
    description: "UUID v1-v5",
  },
];

export interface CheatItem {
  token: string;
  meaning: string;
}

export const CHEATSHEET: CheatItem[] = [
  { token: "\\d \\w \\s", meaning: "digit / word char / whitespace" },
  { token: "^ $", meaning: "start / end of line" },
  { token: "* + ?", meaning: "0+ / 1+ / 0 or 1" },
  { token: "{n,m}", meaning: "between n and m times" },
  { token: "(...) (?:...)", meaning: "capture / non-capturing group" },
  { token: "[abc] [^abc]", meaning: "set / negated set" },
  { token: "a|b", meaning: "alternation" },
  { token: "\\b", meaning: "word boundary" },
];
