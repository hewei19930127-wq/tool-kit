/**
 * Dependency-free syntax tokenizers for the JSON and XML output panes.
 *
 * These are pure functions in the spirit of the tool transforms: they never
 * throw, and the concatenation of every token's `text` always reproduces the
 * input exactly (so highlighting can never drop or reorder characters even on
 * malformed input). The renderer in `HighlightedCode` maps each token type to a
 * semantic color class.
 */

export type Language = "json" | "xml";

export type TokenType =
  | "plain"
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punctuation"
  | "tag"
  | "attr"
  | "comment"
  | "meta";

export interface Token {
  /** Byte offset into the source — used as a stable React key. */
  start: number;
  text: string;
  type: TokenType;
}

export function tokenize(code: string, language: Language): Token[] {
  return language === "json" ? tokenizeJson(code) : tokenizeXml(code);
}

type Push = (start: number, end: number, type: TokenType) => void;

function collector(code: string, tokens: Token[]): Push {
  return (start, end, type) => {
    if (end > start) tokens.push({ start, text: code.slice(start, end), type });
  };
}

const JSON_NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/;
const JSON_LITERAL = /^(true|false|null)/;

function isJsonStarter(ch: string): boolean {
  return (
    ch === '"' ||
    ch === "-" ||
    (ch >= "0" && ch <= "9") ||
    ch === "t" ||
    ch === "f" ||
    ch === "n" ||
    "{}[]:,".includes(ch)
  );
}

function tokenizeJson(code: string): Token[] {
  const tokens: Token[] = [];
  const push = collector(code, tokens);
  const n = code.length;
  let i = 0;

  while (i < n) {
    const ch = code[i];

    if (ch === '"') {
      const start = i;
      i++;
      while (i < n) {
        if (code[i] === "\\") {
          i += 2;
          continue;
        }
        if (code[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      let j = i;
      while (j < n && /\s/.test(code[j])) j++;
      push(start, i, code[j] === ":" ? "key" : "string");
      continue;
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const m = JSON_NUMBER.exec(code.slice(i));
      if (m) {
        push(i, i + m[0].length, "number");
        i += m[0].length;
        continue;
      }
    }

    if (ch === "t" || ch === "f" || ch === "n") {
      const m = JSON_LITERAL.exec(code.slice(i));
      if (m) {
        push(i, i + m[0].length, m[0] === "null" ? "null" : "boolean");
        i += m[0].length;
        continue;
      }
    }

    if ("{}[]:,".includes(ch)) {
      push(i, i + 1, "punctuation");
      i++;
      continue;
    }

    // Whitespace or anything unrecognized — group into one plain run.
    const start = i;
    i++;
    while (i < n && !isJsonStarter(code[i])) i++;
    push(start, i, "plain");
  }

  return tokens;
}

function tokenizeXml(code: string): Token[] {
  const tokens: Token[] = [];
  const push = collector(code, tokens);
  const n = code.length;
  let i = 0;

  while (i < n) {
    if (code.startsWith("<!--", i)) {
      const end = code.indexOf("-->", i + 4);
      const stop = end === -1 ? n : end + 3;
      push(i, stop, "comment");
      i = stop;
      continue;
    }
    if (code.startsWith("<![CDATA[", i)) {
      const end = code.indexOf("]]>", i + 9);
      const stop = end === -1 ? n : end + 3;
      push(i, stop, "meta");
      i = stop;
      continue;
    }
    if (code.startsWith("<?", i)) {
      const end = code.indexOf("?>", i + 2);
      const stop = end === -1 ? n : end + 2;
      push(i, stop, "meta");
      i = stop;
      continue;
    }
    if (code.startsWith("<!", i)) {
      const end = code.indexOf(">", i + 2);
      const stop = end === -1 ? n : end + 1;
      push(i, stop, "meta");
      i = stop;
      continue;
    }
    if (code[i] === "<") {
      const end = code.indexOf(">", i);
      const stop = end === -1 ? n : end + 1;
      tokenizeTag(code, i, stop, push);
      i = stop;
      continue;
    }

    // Text content up to the next tag.
    const next = code.indexOf("<", i);
    const stop = next === -1 ? n : next;
    push(i, stop, "plain");
    i = stop;
  }

  return tokens;
}

function tokenizeTag(code: string, start: number, end: number, push: Push): void {
  let i = start;

  push(i, i + 1, "punctuation"); // opening '<'
  i++;
  if (code[i] === "/") {
    push(i, i + 1, "punctuation");
    i++;
  }

  let j = i;
  while (j < end && !/[\s/>]/.test(code[j])) j++;
  push(i, j, "tag");
  i = j;

  while (i < end) {
    const ch = code[i];

    if (/\s/.test(ch)) {
      let k = i;
      while (k < end && /\s/.test(code[k])) k++;
      push(i, k, "plain");
      i = k;
      continue;
    }
    if (ch === "/" || ch === ">" || ch === "?" || ch === "=") {
      push(i, i + 1, "punctuation");
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let k = i + 1;
      while (k < end && code[k] !== ch) k++;
      const stop = k < end ? k + 1 : end;
      push(i, stop, "string");
      i = stop;
      continue;
    }

    let k = i;
    while (k < end && !/[\s=/>"']/.test(code[k])) k++;
    if (k === i) {
      push(i, i + 1, "plain");
      i++;
    } else {
      push(i, k, "attr");
      i = k;
    }
  }
}
