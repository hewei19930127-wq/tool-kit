import type { I18nKey } from "@/core/i18n";

export interface RegexSnippet {
  nameKey: I18nKey;
  pattern: string;
  flags: string;
  descriptionKey: I18nKey;
}

export const SNIPPETS: RegexSnippet[] = [
  {
    nameKey: "tools.regex.snippet.email.name",
    pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+",
    flags: "g",
    descriptionKey: "tools.regex.snippet.email.description",
  },
  {
    nameKey: "tools.regex.snippet.url.name",
    pattern: "https?://[\\w.-]+(?:/[\\w./?%&=-]*)?",
    flags: "g",
    descriptionKey: "tools.regex.snippet.url.description",
  },
  {
    nameKey: "tools.regex.snippet.ipv4.name",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    flags: "g",
    descriptionKey: "tools.regex.snippet.ipv4.description",
  },
  {
    nameKey: "tools.regex.snippet.isoDate.name",
    pattern: "\\d{4}-\\d{2}-\\d{2}",
    flags: "g",
    descriptionKey: "tools.regex.snippet.isoDate.description",
  },
  {
    nameKey: "tools.regex.snippet.hexColor.name",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: "g",
    descriptionKey: "tools.regex.snippet.hexColor.description",
  },
  {
    nameKey: "tools.regex.snippet.uuid.name",
    pattern: "[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}",
    flags: "gi",
    descriptionKey: "tools.regex.snippet.uuid.description",
  },
];

export interface CheatItem {
  token: string;
  meaningKey: I18nKey;
}

export const CHEATSHEET: CheatItem[] = [
  { token: "\\d \\w \\s", meaningKey: "tools.regex.cheat.charClasses" },
  { token: "^ $", meaningKey: "tools.regex.cheat.anchors" },
  { token: "* + ?", meaningKey: "tools.regex.cheat.quantifiers" },
  { token: "{n,m}", meaningKey: "tools.regex.cheat.range" },
  { token: "(...) (?:...)", meaningKey: "tools.regex.cheat.groups" },
  { token: "[abc] [^abc]", meaningKey: "tools.regex.cheat.sets" },
  { token: "a|b", meaningKey: "tools.regex.cheat.alternation" },
  { token: "\\b", meaningKey: "tools.regex.cheat.boundary" },
];
