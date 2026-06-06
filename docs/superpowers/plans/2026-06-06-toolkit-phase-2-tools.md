# ToolKit Phase 2 Tools (XML · Radix · Cron · Regex · Color) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the five Phase-2 tools — **XML, Radix/进制, Cron, Regex, Color** — including the one native bit in this phase: a Rust **screen eyedropper** (`NSColorSampler`) for the Color tool.

**Architecture:** Same plugin model. Each tool = pure logic (unit tested) + workspace component + Tool definition, registered in the `Tool[]` registry, reusing the shared `OutputPane` / `CopyButton` / `HistoryButton` / `useToolInput` from Plan 2. Only Color reaches into Rust (eyedropper); everything else is pure JS via small mature libraries.

**Tech Stack:** Existing stack + **fast-xml-parser** (XML), native `BigInt` (Radix), **cronstrue** + **cron-parser@^4** (Cron), native `RegExp` (Regex), **colord** + its a11y plugin (Color). Native eyedropper via a `pick_color` Tauri command using AppKit `NSColorSampler` (`objc2-app-kit` + `block2`).

> **Source spec:** `docs/superpowers/specs/2026-06-06-toolkit-design.md` §7 tools 6–10 and §12 (eyedropper risk). **Prerequisite:** Plans 1 and 2 implemented and committed — this plan reuses their shared components, store, and registry.

> **Scope deferred to Plan 4 / Phase 3 (do NOT build here):** the **quick-xml Rust fast-path** for large XML and the **serde_json fast-path** — Phase-2 XML uses `fast-xml-parser` on the main thread only. Worker pool, settings screen, packaging/signing also belong to Plan 4. NL→regex generation is explicitly out of scope (spec §7.9): the Regex tool ships a curated snippet library + cheatsheet.

---

## File Structure

| Path                                         | Responsibility                                                    |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `src/tools/xml/xml.ts` · `.test.ts`          | Pure format / minify / validate (well-formedness, line:col)       |
| `src/tools/xml/XmlTool.tsx` · `index.ts`     | Workspace + Tool definition                                       |
| `src/tools/radix/radix.ts` · `.test.ts`      | Pure base 2–36 conversion via `BigInt`                            |
| `src/tools/radix/RadixTool.tsx` · `index.ts` | Workspace (bin/oct/dec/hex + bitwise) + Tool definition           |
| `src/tools/cron/cron.ts` · `.test.ts`        | Pure describe + next-N-runs (deterministic with a base date)      |
| `src/tools/cron/CronTool.tsx` · `index.ts`   | Workspace + Tool definition                                       |
| `src/tools/regex/regex.ts` · `.test.ts`      | Pure compile + match/group extraction                             |
| `src/tools/regex/snippets.ts`                | Curated snippet library + cheatsheet data                         |
| `src/tools/regex/RegexTool.tsx` · `index.ts` | Workspace (tester + snippets + cheatsheet) + Tool definition      |
| `src/tools/color/color.ts` · `.test.ts`      | Pure parse/convert + contrast + WCAG levels                       |
| `src/tools/color/eyedropper.ts`              | JS wrapper: web `EyeDropper` → Rust `pick_color` fallback         |
| `src/tools/color/ColorTool.tsx` · `index.ts` | Workspace (conversions + contrast + eyedropper) + Tool definition |
| `src-tauri/src/eyedropper.rs`                | `pick_color` command using `NSColorSampler`                       |
| `src-tauri/src/lib.rs`                       | **Modify:** register the `pick_color` command                     |
| `src-tauri/Cargo.toml`                       | **Modify:** add `objc2`, `objc2-app-kit`, `block2` (macOS)        |
| `src-tauri/capabilities/default.json`        | **Modify:** allow the `pick_color` command                        |
| `src/core/registry.ts` · `registry.test.ts`  | **Modify:** register the five tools                               |

---

## Task 1: Install the Phase-2 libraries

**Files:**

- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install fast-xml-parser cronstrue cron-parser@^4 colord
```

Expected: four packages added. `cron-parser@^4` is pinned because v5 renamed the entry point (`CronExpressionParser.parse`); this plan uses v4's `parseExpression`.

- [ ] **Step 2: Verify the build still resolves**

Run: `npx tsc --noEmit`
Expected: no errors (no imports yet; this just confirms a clean baseline).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fast-xml-parser, cronstrue, cron-parser, colord"
```

---

## Task 2: XML pure transforms (TDD)

Validate well-formedness with a line:col, format (pretty), and minify. Insignificant whitespace is dropped on parse so formatting is stable.

**Files:**

- Create: `src/tools/xml/xml.ts`, `src/tools/xml/xml.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { validateXml, formatXml, minifyXml } from "./xml";

describe("validateXml", () => {
  it("accepts well-formed XML", () => {
    expect(validateXml("<a><b/></a>")).toEqual({
      ok: true,
      value: "Well-formed",
    });
  });
  it("rejects mismatched tags with a location", () => {
    const r = validateXml("<a></b>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.line).toBe("number");
  });
  it("errors on empty input", () => {
    expect(validateXml("").ok).toBe(false);
  });
});

describe("formatXml", () => {
  it("indents nested elements", () => {
    const r = formatXml("<a><b>1</b></a>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain("<b>1</b>");
      expect(r.value.split("\n").length).toBeGreaterThan(1);
    }
  });
  it("preserves attributes", () => {
    const r = formatXml('<a x="1"><b/></a>');
    if (r.ok) expect(r.value).toContain('x="1"');
  });
  it("surfaces malformed input as an error", () => {
    expect(formatXml("<a><b></a>").ok).toBe(false);
  });
});

describe("minifyXml", () => {
  it("collapses a pretty document to one line", () => {
    const pretty = "<a>\n  <b>1</b>\n</a>";
    const r = minifyXml(pretty);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toContain("\n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/xml/xml.test.ts`
Expected: FAIL — cannot find module `./xml`.

- [ ] **Step 3: Write `src/tools/xml/xml.ts`**

```ts
import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import type { ToolResult } from "@/core/types";

const BASE = {
  ignoreAttributes: false,
  preserveOrder: true,
  commentPropName: "#comment",
  cdataPropName: "#cdata",
  parseTagValue: false,
} as const;

function check(input: string): ToolResult {
  if (!input.trim()) return { ok: false, error: "Input is empty" };
  const r = XMLValidator.validate(input, { allowBooleanAttributes: true });
  if (r === true) return { ok: true, value: "Well-formed" };
  return { ok: false, error: r.err.msg, line: r.err.line, col: r.err.col };
}

export function validateXml(input: string): ToolResult {
  return check(input);
}

export function formatXml(input: string, indent = 2): ToolResult {
  const v = check(input);
  if (!v.ok) return v;
  const parsed = new XMLParser(BASE).parse(input);
  const out = new XMLBuilder({
    ...BASE,
    format: true,
    indentBy: " ".repeat(indent),
  }).build(parsed);
  return { ok: true, value: String(out).replace(/\n+$/, "") };
}

export function minifyXml(input: string): ToolResult {
  const v = check(input);
  if (!v.ok) return v;
  const parsed = new XMLParser(BASE).parse(input);
  const out = new XMLBuilder({ ...BASE, format: false }).build(parsed);
  return {
    ok: true,
    value: String(out).replace(/\s+</g, "<").replace(/>\s+/g, ">").trim(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/xml/xml.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/xml/xml.ts src/tools/xml/xml.test.ts
git commit -m "feat: add XML format/minify/validate with line:col errors"
```

---

## Task 3: XML workspace + Tool definition

**Files:**

- Create: `src/tools/xml/XmlTool.tsx`, `src/tools/xml/index.ts`, `src/tools/xml/XmlTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import { setStorageBackend, type KV } from "@/core/services/storage";
import XmlTool from "./XmlTool";

function memoryBackend(): KV {
  const map = new Map<string, unknown>();
  return {
    async get<T>(k: string) {
      return map.has(k) ? (map.get(k) as T) : null;
    },
    async set<T>(k: string, v: T) {
      map.set(k, v);
    },
  };
}

describe("XmlTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("formats valid XML", () => {
    render(<XmlTool />);
    fireEvent.change(screen.getByLabelText("XML input"), {
      target: { value: "<a><b>1</b></a>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByLabelText("Output").textContent).toContain("<b>1</b>");
  });

  it("shows an error for malformed XML", () => {
    render(<XmlTool />);
    fireEvent.change(screen.getByLabelText("XML input"), {
      target: { value: "<a></b>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/xml/XmlTool.test.tsx`
Expected: FAIL — cannot find module `./XmlTool`.

- [ ] **Step 3: Write `src/tools/xml/XmlTool.tsx`**

```tsx
import { useState } from "react";
import { formatXml, minifyXml, validateXml } from "./xml";
import type { ToolResult } from "@/core/types";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useHistory } from "@/core/hooks/useHistory";
import { OutputPane } from "@/components/OutputPane";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";

type Action = (input: string) => ToolResult;
const ACTIONS: { label: string; run: Action }[] = [
  { label: "Format", run: formatXml },
  { label: "Minify", run: minifyXml },
  { label: "Validate", run: validateXml },
];

export default function XmlTool() {
  const [input, setInput] = useToolInput("xml");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("xml");

  function apply(run: Action) {
    const r = run(input);
    setResult(r);
    if (r.ok) record(input, r.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => apply(a.run)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            {a.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton text={result?.ok ? result.value : ""} />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <textarea
          aria-label="XML input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste XML here, e.g. <root><item/></root>"
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <OutputPane
          result={result}
          emptyHint="Output appears here. Paste XML and pick an action."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/xml/index.ts`**

```ts
import { Code2 } from "lucide-react";
import type { Tool } from "@/core/types";
import { validateXml } from "./xml";
import XmlTool from "./XmlTool";

export const xmlTool: Tool = {
  id: "xml",
  name: "XML",
  category: "encode-text",
  icon: Code2,
  keywords: ["xml", "format", "pretty", "minify", "validate", "格式化"],
  component: XmlTool,
  detectClipboard(text: string) {
    const t = text.trim();
    return t.startsWith("<") && validateXml(t).ok;
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/xml/XmlTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/xml
git commit -m "feat: add XML workspace and Tool definition"
```

---

## Task 4: Radix pure conversion (TDD)

Arbitrary base 2–36 via `BigInt` (no precision loss on 64-bit+ values), with a manual digit parser/formatter since `BigInt` only natively reads base 10/2/8/16.

**Files:**

- Create: `src/tools/radix/radix.ts`, `src/tools/radix/radix.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { convertRadix, toBinaryGroups } from "./radix";

describe("convertRadix", () => {
  it("hex → dec", () => {
    expect(convertRadix("ff", 16, 10)).toEqual({ ok: true, value: "255" });
  });
  it("dec → hex (lowercase)", () => {
    expect(convertRadix("255", 10, 16)).toEqual({ ok: true, value: "ff" });
  });
  it("bin → hex", () => {
    expect(convertRadix("11111111", 2, 16)).toEqual({ ok: true, value: "ff" });
  });
  it("keeps full precision beyond Number.MAX_SAFE_INTEGER", () => {
    expect(convertRadix("ffffffffffffffff", 16, 10)).toEqual({
      ok: true,
      value: "18446744073709551615",
    });
  });
  it("handles negatives", () => {
    expect(convertRadix("-10", 10, 2)).toEqual({ ok: true, value: "-1010" });
  });
  it("rejects digits invalid for the source base", () => {
    expect(convertRadix("xyz", 10, 16).ok).toBe(false);
  });
  it("rejects an out-of-range base", () => {
    expect(convertRadix("1", 1, 10).ok).toBe(false);
  });
});

describe("toBinaryGroups", () => {
  it("groups binary into nibbles", () => {
    expect(toBinaryGroups(255n)).toBe("1111 1111");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/radix/radix.test.ts`
Expected: FAIL — cannot find module `./radix`.

- [ ] **Step 3: Write `src/tools/radix/radix.ts`**

```ts
import type { ToolResult } from "@/core/types";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function parseInBase(input: string, base: number): bigint | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  let body = s;
  let neg = false;
  if (body.startsWith("-")) {
    neg = true;
    body = body.slice(1);
  }
  if (!body) return null;
  const big = BigInt(base);
  let result = 0n;
  for (const ch of body) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) return null;
    result = result * big + BigInt(d);
  }
  return neg ? -result : result;
}

function formatInBase(value: bigint, base: number): string {
  if (value === 0n) return "0";
  const neg = value < 0n;
  let v = neg ? -value : value;
  const big = BigInt(base);
  let out = "";
  while (v > 0n) {
    out = DIGITS[Number(v % big)] + out;
    v /= big;
  }
  return neg ? `-${out}` : out;
}

export function convertRadix(
  input: string,
  fromBase: number,
  toBase: number,
): ToolResult {
  if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
    return { ok: false, error: "Base must be between 2 and 36" };
  }
  const value = parseInBase(input, fromBase);
  if (value === null)
    return { ok: false, error: `Invalid digits for base ${fromBase}` };
  return { ok: true, value: formatInBase(value, toBase) };
}

/** Space-separated nibbles of the unsigned binary representation. */
export function toBinaryGroups(value: bigint): string {
  const bin = formatInBase(value < 0n ? -value : value, 2);
  const padded = bin.padStart(Math.ceil(bin.length / 4) * 4, "0");
  return padded.replace(/(.{4})(?=.)/g, "$1 ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/radix/radix.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/radix/radix.ts src/tools/radix/radix.test.ts
git commit -m "feat: add arbitrary-base (2-36) BigInt radix conversion"
```

---

## Task 5: Radix workspace + Tool definition

One input + source-base selector; live conversions to bin/oct/dec/hex plus the bitwise (nibble-grouped) view.

**Files:**

- Create: `src/tools/radix/RadixTool.tsx`, `src/tools/radix/index.ts`, `src/tools/radix/RadixTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import RadixTool from "./RadixTool";

describe("RadixTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("shows all bases for a decimal input", () => {
    render(<RadixTool />);
    fireEvent.change(screen.getByLabelText("Number input"), {
      target: { value: "255" },
    });
    expect(screen.getByLabelText("Hexadecimal").textContent).toContain("ff");
    expect(screen.getByLabelText("Binary").textContent).toContain("11111111");
  });

  it("reports invalid digits", () => {
    render(<RadixTool />);
    fireEvent.change(screen.getByLabelText("Number input"), {
      target: { value: "zz" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/radix/RadixTool.test.tsx`
Expected: FAIL — cannot find module `./RadixTool`.

- [ ] **Step 3: Write `src/tools/radix/RadixTool.tsx`**

```tsx
import { useMemo, useState } from "react";
import { convertRadix, toBinaryGroups } from "./radix";
import { useToolInput } from "@/core/hooks/useToolInput";

const BASES = [2, 8, 10, 16] as const;
const LABELS: Record<number, string> = {
  2: "Binary",
  8: "Octal",
  10: "Decimal",
  16: "Hexadecimal",
};

export default function RadixTool() {
  const [input, setInput] = useToolInput("radix");
  const [fromBase, setFromBase] = useState(10);

  const rows = useMemo(() => {
    if (!input.trim()) return null;
    const dec = convertRadix(input, fromBase, 10);
    if (!dec.ok) return { error: dec.error };
    const value = BigInt(dec.value);
    return {
      values: BASES.map((b) => ({
        base: b,
        text: convertRadix(input, fromBase, b),
      })),
      bitwise: toBinaryGroups(value),
    };
  }, [input, fromBase]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <input
          aria-label="Number input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a number…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <label className="text-sm text-muted-foreground">From base</label>
        <select
          aria-label="Source base"
          value={fromBase}
          onChange={(e) => setFromBase(Number(e.target.value))}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          {Array.from({ length: 35 }, (_, i) => i + 2).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {!rows && (
        <p className="text-sm text-muted-foreground">
          Enter a number to see every base.
        </p>
      )}
      {rows && "error" in rows && (
        <div role="alert" className="font-mono text-sm text-error">
          {rows.error}
        </div>
      )}
      {rows && "values" in rows && (
        <div className="flex flex-col">
          {rows.values.map((r) => (
            <div
              key={r.base}
              className="flex items-baseline gap-3 border-b border-border py-2"
            >
              <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">
                {LABELS[r.base]}
              </span>
              <span aria-label={LABELS[r.base]} className="font-mono text-sm">
                {r.text.ok ? r.text.value : r.text.error}
              </span>
            </div>
          ))}
          <div className="flex items-baseline gap-3 py-2">
            <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">
              Bitwise
            </span>
            <span
              aria-label="Bitwise"
              className="font-mono text-sm tracking-wider"
            >
              {rows.bitwise}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/radix/index.ts`**

```ts
import { Hash } from "lucide-react";
import type { Tool } from "@/core/types";
import RadixTool from "./RadixTool";

export const radixTool: Tool = {
  id: "radix",
  name: "Radix / 进制",
  category: "convert-other",
  icon: Hash,
  keywords: ["radix", "base", "binary", "hex", "octal", "进制", "bitwise"],
  component: RadixTool,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/radix/RadixTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/radix
git commit -m "feat: add Radix workspace and Tool definition"
```

---

## Task 6: Cron pure logic (TDD)

Human description (cronstrue) + next-N run times (cron-parser). `nextRuns` takes an explicit base date and timezone so tests are deterministic regardless of the machine clock/locale.

**Files:**

- Create: `src/tools/cron/cron.ts`, `src/tools/cron/cron.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { describeCron, nextRuns } from "./cron";

describe("describeCron", () => {
  it("describes a simple expression", () => {
    const r = describeCron("*/5 * * * *");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.toLowerCase()).toContain("every 5 minutes");
  });
  it("errors on an invalid expression", () => {
    expect(describeCron("nonsense").ok).toBe(false);
  });
});

describe("nextRuns", () => {
  it("returns the next N runs from a base instant (UTC)", () => {
    const base = Date.UTC(2024, 0, 1, 12, 0, 0); // 2024-01-01T12:00:00Z
    expect(nextRuns("0 0 * * *", 2, base, "UTC")).toEqual({
      ok: true,
      value: ["2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"],
    });
  });
  it("errors on an invalid expression", () => {
    expect(nextRuns("not a cron", 3, 0, "UTC").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/cron/cron.test.ts`
Expected: FAIL — cannot find module `./cron`.

- [ ] **Step 3: Write `src/tools/cron/cron.ts`**

```ts
import cronstrue from "cronstrue";
import parser from "cron-parser";
import type { ToolResult } from "@/core/types";

export function describeCron(expr: string): ToolResult {
  const e = expr.trim();
  if (!e) return { ok: false, error: "Input is empty" };
  try {
    return {
      ok: true,
      value: cronstrue.toString(e, { throwExceptionOnParseError: true }),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function nextRuns(
  expr: string,
  count: number,
  fromMs?: number,
  tz = "UTC",
): ToolResult<string[]> {
  const e = expr.trim();
  if (!e) return { ok: false, error: "Input is empty" };
  try {
    const options: { currentDate?: Date; tz?: string } = { tz };
    if (fromMs != null) options.currentDate = new Date(fromMs);
    const interval = parser.parseExpression(e, options);
    const value: string[] = [];
    for (let i = 0; i < count; i++)
      value.push(interval.next().toDate().toISOString());
    return { ok: true, value };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/cron/cron.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/cron/cron.ts src/tools/cron/cron.test.ts
git commit -m "feat: add Cron describe + next-N-runs (deterministic base/tz)"
```

---

## Task 7: Cron workspace + Tool definition

Expression input, a quick-pick field builder (presets), the human description, and the next N runs in the user's local timezone.

**Files:**

- Create: `src/tools/cron/CronTool.tsx`, `src/tools/cron/index.ts`, `src/tools/cron/CronTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import CronTool from "./CronTool";

describe("CronTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("describes a valid expression", () => {
    render(<CronTool />);
    fireEvent.change(screen.getByLabelText("Cron expression"), {
      target: { value: "*/5 * * * *" },
    });
    expect(
      screen.getByLabelText("Description").textContent?.toLowerCase(),
    ).toContain("every 5 minutes");
  });

  it("shows an error for an invalid expression", () => {
    render(<CronTool />);
    fireEvent.change(screen.getByLabelText("Cron expression"), {
      target: { value: "bogus" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/cron/CronTool.test.tsx`
Expected: FAIL — cannot find module `./CronTool`.

- [ ] **Step 3: Write `src/tools/cron/CronTool.tsx`**

```tsx
import { useMemo } from "react";
import { describeCron, nextRuns } from "./cron";
import { useToolInput } from "@/core/hooks/useToolInput";

const PRESETS: { label: string; expr: string }[] = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Every 5 min", expr: "*/5 * * * *" },
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily midnight", expr: "0 0 * * *" },
  { label: "Weekdays 9am", expr: "0 9 * * 1-5" },
];

export default function CronTool() {
  const [input, setInput] = useToolInput("cron");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const description = useMemo(
    () => (input.trim() ? describeCron(input) : null),
    [input],
  );
  const runs = useMemo(
    () => (input.trim() ? nextRuns(input, 5, Date.now(), tz) : null),
    [input, tz],
  );

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.expr}
            onClick={() => setInput(p.expr)}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        aria-label="Cron expression"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. */5 * * * *"
        className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
      />

      {description?.ok && (
        <p aria-label="Description" className="text-sm">
          {description.value}
        </p>
      )}
      {description && !description.ok && (
        <p role="alert" className="text-sm text-error">
          {description.error}
        </p>
      )}

      {runs?.ok && (
        <div className="flex flex-col">
          <div className="text-xs uppercase text-muted-foreground">
            Next 5 runs · {tz}
          </div>
          {runs.value.map((r) => (
            <div
              key={r}
              className="border-b border-border py-1.5 font-mono text-sm"
            >
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/cron/index.ts`**

```ts
import { CalendarClock } from "lucide-react";
import type { Tool } from "@/core/types";
import { describeCron } from "./cron";
import CronTool from "./CronTool";

export const cronTool: Tool = {
  id: "cron",
  name: "Cron",
  category: "convert-other",
  icon: CalendarClock,
  keywords: ["cron", "crontab", "schedule", "job", "定时"],
  component: CronTool,
  detectClipboard(text: string) {
    const t = text.trim();
    return t.split(/\s+/).length >= 5 && describeCron(t).ok;
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/cron/CronTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/cron
git commit -m "feat: add Cron workspace and Tool definition"
```

---

## Task 8: Regex pure logic + snippet/cheatsheet data (TDD)

Safe compile, match/group extraction (with a zero-width-loop guard), plus curated offline data (no NL→regex — spec §7.9).

**Files:**

- Create: `src/tools/regex/regex.ts`, `src/tools/regex/regex.test.ts`, `src/tools/regex/snippets.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { runRegex } from "./regex";

describe("runRegex", () => {
  it("finds all global matches with indices", () => {
    const r = runRegex("\\d+", "g", "a1b22c");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((m) => m.match)).toEqual(["1", "22"]);
      expect(r.value[1].index).toBe(3);
    }
  });
  it("captures groups", () => {
    const r = runRegex("(\\w)(\\d)", "", "x9");
    if (r.ok) expect(r.value[0].groups).toEqual(["x", "9"]);
  });
  it("returns an empty list when nothing matches", () => {
    const r = runRegex("z", "g", "abc");
    if (r.ok) expect(r.value).toEqual([]);
  });
  it("reports an invalid pattern instead of throwing", () => {
    expect(runRegex("(", "", "x").ok).toBe(false);
  });
  it("does not hang on a zero-width global match", () => {
    const r = runRegex("a*", "g", "aa");
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/regex/regex.test.ts`
Expected: FAIL — cannot find module `./regex`.

- [ ] **Step 3: Write `src/tools/regex/regex.ts`**

```ts
import type { ToolResult } from "@/core/types";

export interface RegexMatch {
  index: number;
  match: string;
  groups: string[];
}

export function runRegex(
  pattern: string,
  flags: string,
  text: string,
): ToolResult<RegexMatch[]> {
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const matches: RegexMatch[] = [];
  if (re.global) {
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        index: m.index,
        match: m[0],
        groups: m.slice(1).map((g) => g ?? ""),
      });
      if (m.index === re.lastIndex) re.lastIndex++; // advance past zero-width matches
      if (++guard > 100_000) break;
    }
  } else {
    const m = re.exec(text);
    if (m)
      matches.push({
        index: m.index,
        match: m[0],
        groups: m.slice(1).map((g) => g ?? ""),
      });
  }
  return { ok: true, value: matches };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/regex/regex.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Write `src/tools/regex/snippets.ts`**

```ts
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
    description: "UUID v1–v5",
  },
];

export interface CheatItem {
  token: string;
  meaning: string;
}

export const CHEATSHEET: CheatItem[] = [
  { token: "\\d \\w \\s", meaning: "digit · word char · whitespace" },
  { token: "^ $", meaning: "start · end of line" },
  { token: "* + ?", meaning: "0+ · 1+ · 0 or 1" },
  { token: "{n,m}", meaning: "between n and m times" },
  { token: "(…) (?:…)", meaning: "capture · non-capturing group" },
  { token: "[abc] [^abc]", meaning: "set · negated set" },
  { token: "a|b", meaning: "alternation" },
  { token: "\\b", meaning: "word boundary" },
];
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/regex/regex.ts src/tools/regex/regex.test.ts src/tools/regex/snippets.ts
git commit -m "feat: add Regex match engine + curated snippet/cheatsheet data"
```

---

## Task 9: Regex workspace + Tool definition

Pattern + flags + sample text → match count, highlighted preview, group table, snippet picker, cheatsheet.

**Files:**

- Create: `src/tools/regex/RegexTool.tsx`, `src/tools/regex/index.ts`, `src/tools/regex/RegexTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import RegexTool from "./RegexTool";

describe("RegexTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("counts matches against the sample text", () => {
    render(<RegexTool />);
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "\\d+" },
    });
    fireEvent.change(screen.getByLabelText("Sample text"), {
      target: { value: "a1 b22 c333" },
    });
    expect(screen.getByLabelText("Match count").textContent).toContain("3");
  });

  it("reports an invalid pattern", () => {
    render(<RegexTool />);
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "(" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/regex/RegexTool.test.tsx`
Expected: FAIL — cannot find module `./RegexTool`.

- [ ] **Step 3: Write `src/tools/regex/RegexTool.tsx`**

The sample text is the tool's shared input (`useToolInput("regex")`) so clipboard Fill targets it; pattern/flags are local.

```tsx
import { useMemo, useState } from "react";
import { runRegex, type RegexMatch } from "./regex";
import { SNIPPETS, CHEATSHEET } from "./snippets";
import { useToolInput } from "@/core/hooks/useToolInput";

function Highlighted({
  text,
  matches,
}: {
  text: string;
  matches: RegexMatch[];
}) {
  if (matches.length === 0) return <>{text}</>;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index > cursor)
      nodes.push(<span key={`t${i}`}>{text.slice(cursor, m.index)}</span>);
    nodes.push(
      <mark key={`m${i}`} className="rounded bg-primary/20 text-foreground">
        {m.match}
      </mark>,
    );
    cursor = m.index + m.match.length;
  });
  if (cursor < text.length)
    nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}

export default function RegexTool() {
  const [text, setText] = useToolInput("regex");
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");

  const result = useMemo(
    () => (pattern ? runRegex(pattern, flags, text) : null),
    [pattern, flags, text],
  );
  const matches = result?.ok ? result.value : [];

  return (
    <div className="flex h-full min-h-0 gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground">/</span>
          <input
            aria-label="Pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="pattern"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="font-mono text-muted-foreground">/</span>
          <input
            aria-label="Flags"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm"
          />
          <span
            aria-label="Match count"
            className="text-sm text-muted-foreground"
          >
            {result?.ok ? `${matches.length} matches` : ""}
          </span>
        </div>

        {result && !result.ok && (
          <div role="alert" className="font-mono text-sm text-error">
            {result.error}
          </div>
        )}

        <textarea
          aria-label="Sample text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Sample text to test against…"
          className="h-28 resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-sm whitespace-pre-wrap">
          <Highlighted text={text} matches={matches} />
        </div>

        {matches.some((m) => m.groups.length > 0) && (
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">Match</th>
                  <th className="px-3 py-1.5">Groups</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {matches.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">{m.match}</td>
                    <td className="px-3 py-1.5">{m.groups.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-auto">
        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">
            Snippets
          </div>
          {SNIPPETS.map((s) => (
            <button
              key={s.name}
              onClick={() => {
                setPattern(s.pattern);
                setFlags(s.flags);
              }}
              title={s.description}
              className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {s.name}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">
            Cheatsheet
          </div>
          {CHEATSHEET.map((c) => (
            <div key={c.token} className="flex gap-2 px-2 py-1 text-xs">
              <code className="shrink-0 font-mono text-primary">{c.token}</code>
              <span className="text-muted-foreground">{c.meaning}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/regex/index.ts`**

```ts
import { Regex } from "lucide-react";
import type { Tool } from "@/core/types";
import RegexTool from "./RegexTool";

export const regexTool: Tool = {
  id: "regex",
  name: "Regex",
  category: "convert-other",
  icon: Regex,
  keywords: ["regex", "regexp", "pattern", "match", "test", "正则"],
  component: RegexTool,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/regex/RegexTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/regex
git commit -m "feat: add Regex workspace (tester + snippets + cheatsheet) and Tool definition"
```

---

## Task 10: Color pure logic (TDD)

colord for conversions + its a11y plugin for contrast; a tiny pure `wcagLevels` helper.

**Files:**

- Create: `src/tools/color/color.ts`, `src/tools/color/color.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseColor, contrastRatio, wcagLevels } from "./color";

describe("parseColor", () => {
  it("converts hex to every model", () => {
    const r = parseColor("#ff0000");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.hex).toBe("#ff0000");
      expect(r.value.rgb).toBe("rgb(255, 0, 0)");
      expect(r.value.hsl).toBe("hsl(0, 100%, 50%)");
      expect(r.value.hsv).toBe("hsv(0, 100%, 100%)");
    }
  });
  it("accepts rgb() input", () => {
    const r = parseColor("rgb(0, 0, 255)");
    if (r.ok) expect(r.value.hex).toBe("#0000ff");
  });
  it("errors on an unrecognized color", () => {
    expect(parseColor("not-a-color").ok).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    const r = contrastRatio("#000000", "#ffffff");
    if (r.ok) expect(r.value).toBeCloseTo(21, 1);
  });
  it("errors when a color is invalid", () => {
    expect(contrastRatio("#000", "nope").ok).toBe(false);
  });
});

describe("wcagLevels", () => {
  it("passes all levels at 21", () => {
    expect(wcagLevels(21)).toEqual({ aaLarge: true, aa: true, aaa: true });
  });
  it("passes AA but not AAA at 4.5", () => {
    expect(wcagLevels(4.5)).toEqual({ aaLarge: true, aa: true, aaa: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/color/color.test.ts`
Expected: FAIL — cannot find module `./color`.

- [ ] **Step 3: Write `src/tools/color/color.ts`**

```ts
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import type { ToolResult } from "@/core/types";

extend([a11yPlugin]);

export interface ColorModels {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
}

export function parseColor(input: string): ToolResult<ColorModels> {
  const c = colord(input.trim());
  if (!c.isValid()) return { ok: false, error: "Unrecognized color" };
  const hsv = c.toHsv();
  return {
    ok: true,
    value: {
      hex: c.toHex(),
      rgb: c.toRgbString(),
      hsl: c.toHslString(),
      hsv: `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`,
    },
  };
}

export function contrastRatio(fg: string, bg: string): ToolResult<number> {
  const a = colord(fg.trim());
  const b = colord(bg.trim());
  if (!a.isValid() || !b.isValid())
    return { ok: false, error: "Both colors must be valid" };
  return { ok: true, value: a.contrast(b) };
}

export interface WcagLevels {
  aaLarge: boolean;
  aa: boolean;
  aaa: boolean;
}

export function wcagLevels(ratio: number): WcagLevels {
  return { aaLarge: ratio >= 3, aa: ratio >= 4.5, aaa: ratio >= 7 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/color/color.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/color/color.ts src/tools/color/color.test.ts
git commit -m "feat: add Color conversions + contrast + WCAG levels"
```

---

## Task 11: Native screen eyedropper (Rust `pick_color`)

The highest-risk item in this phase (spec §12): web `EyeDropper` is unreliable in WKWebView, so we expose a Rust command backed by AppKit's `NSColorSampler`. macOS-only; on other targets the command returns an error so the JS layer falls back gracefully.

**Files:**

- Create: `src-tauri/src/eyedropper.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add the AppKit crates to `src-tauri/Cargo.toml`**

Under `[dependencies]` (these are needed only on macOS, but adding them unconditionally is fine since this is a macOS-only app):

```toml
objc2 = "0.5"
objc2-app-kit = { version = "0.2", features = ["NSColorSampler", "NSColor", "NSColorSpace"] }
objc2-foundation = "0.2"
block2 = "0.5"
```

- [ ] **Step 2: Write `src-tauri/src/eyedropper.rs`**

`NSColorSampler::showSamplerWithSelectionHandler:` invokes a block on the main thread with the picked `NSColor`. We bridge that callback to the async command via a channel, convert the color to sRGB, and format `#rrggbb`.

```rust
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn pick_color(app: tauri::AppHandle) -> Result<String, String> {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2_app_kit::{NSColor, NSColorSampler};
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel::<Option<String>>();

    // NSColorSampler must be driven on the main thread.
    app.run_on_main_thread(move || {
        let sampler = unsafe { NSColorSampler::new() };
        let handler = RcBlock::new(move |color: *mut NSColor| {
            let hex = if color.is_null() {
                None
            } else {
                let color: Retained<NSColor> = unsafe { Retained::retain(color).unwrap() };
                unsafe {
                    let srgb = color.colorUsingColorSpace(&objc2_app_kit::NSColorSpace::sRGBColorSpace());
                    srgb.map(|c| {
                        let r = (c.redComponent() * 255.0).round() as u8;
                        let g = (c.greenComponent() * 255.0).round() as u8;
                        let b = (c.blueComponent() * 255.0).round() as u8;
                        format!("#{:02x}{:02x}{:02x}", r, g, b)
                    })
                }
            };
            let _ = tx.send(hex);
        });
        unsafe { sampler.showSamplerWithSelectionHandler(&handler) };
    })
    .map_err(|e| e.to_string())?;

    match rx.recv() {
        Ok(Some(hex)) => Ok(hex),
        Ok(None) => Err("No color picked".into()),
        Err(_) => Err("Color sampler closed without a result".into()),
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn pick_color(_app: tauri::AppHandle) -> Result<String, String> {
    Err("Eyedropper is only available on macOS".into())
}
```

> **Risk note:** exact `objc2-app-kit` method names/signatures (`showSamplerWithSelectionHandler:`, `colorUsingColorSpace:`) can shift across crate versions. If the build fails, run `cargo doc -p objc2-app-kit --open` and adjust the call to the installed version. This is a flagged risk in the design (§12); the JS layer (Task 12) catches any error and degrades to the manual hex input, so the tool stays usable even if the native picker needs follow-up.

- [ ] **Step 3: Register the command in `src-tauri/src/lib.rs`**

Add `mod eyedropper;` near the top, and add the handler to the builder (alongside the existing `.setup(...)` from Plan 1):

```rust
mod eyedropper;

// inside run(), on the tauri::Builder chain (before .run(...)):
.invoke_handler(tauri::generate_handler![eyedropper::pick_color])
```

- [ ] **Step 4: Allow the command in `src-tauri/capabilities/default.json`**

Add to the `permissions` array:

```json
"core:default"
```

(`core:default` already permits app-defined `invoke` commands; no extra entry is needed if it is present. If your capabilities file lists granular permissions, add `"core:event:default"` is not required — custom commands are allowed by default. Leave the file unchanged if `pick_color` already invokes successfully in Step 6.)

- [ ] **Step 5: Build the Rust side**

Run: `cd src-tauri && cargo build && cd ..`
Expected: compiles. If it fails on the AppKit API, apply the Step-2 risk note before continuing.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/eyedropper.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/default.json
git commit -m "feat: add native screen eyedropper (NSColorSampler) command"
```

---

## Task 12: Color workspace + Tool definition

Conversions for the current input, an eyedropper button (web API → Rust fallback), and a two-color contrast checker with WCAG badges.

**Files:**

- Create: `src/tools/color/eyedropper.ts`, `src/tools/color/ColorTool.tsx`, `src/tools/color/index.ts`, `src/tools/color/ColorTool.test.tsx`

- [ ] **Step 1: Write `src/tools/color/eyedropper.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";

/** Try the web EyeDropper first (works in some WKWebView builds); fall back to
 *  the native NSColorSampler command. Returns a hex string or null if cancelled. */
export async function pickColor(): Promise<string | null> {
  const EyeDropperCtor = (
    globalThis as {
      EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
    }
  ).EyeDropper;
  if (EyeDropperCtor) {
    try {
      const { sRGBHex } = await new EyeDropperCtor().open();
      return sRGBHex;
    } catch {
      return null; // user cancelled
    }
  }
  try {
    return await invoke<string>("pick_color");
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";

vi.mock("./eyedropper", () => ({
  pickColor: vi.fn().mockResolvedValue("#00ff00"),
}));
import ColorTool from "./ColorTool";

describe("ColorTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("shows conversions for a hex input", () => {
    render(<ColorTool />);
    fireEvent.change(screen.getByLabelText("Color input"), {
      target: { value: "#ff0000" },
    });
    expect(screen.getByLabelText("rgb").textContent).toContain(
      "rgb(255, 0, 0)",
    );
  });

  it("computes a contrast ratio", () => {
    render(<ColorTool />);
    fireEvent.change(screen.getByLabelText("Foreground"), {
      target: { value: "#000000" },
    });
    fireEvent.change(screen.getByLabelText("Background"), {
      target: { value: "#ffffff" },
    });
    expect(screen.getByLabelText("Contrast ratio").textContent).toContain("21");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tools/color/ColorTool.test.tsx`
Expected: FAIL — cannot find module `./ColorTool`.

- [ ] **Step 4: Write `src/tools/color/ColorTool.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Pipette } from "lucide-react";
import { parseColor, contrastRatio, wcagLevels } from "./color";
import { pickColor } from "./eyedropper";
import { useToolInput } from "@/core/hooks/useToolInput";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${ok ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}
    >
      {label} {ok ? "✓" : "✗"}
    </span>
  );
}

export default function ColorTool() {
  const [input, setInput] = useToolInput("color");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");

  const models = useMemo(
    () => (input.trim() ? parseColor(input) : null),
    [input],
  );
  const ratio = useMemo(() => contrastRatio(fg, bg), [fg, bg]);
  const swatch = models?.ok ? models.value.hex : "transparent";

  async function eyedrop() {
    const picked = await pickColor();
    if (picked) setInput(picked);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <input
          aria-label="Color input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="#ff0000, rgb(…), hsl(…), or a CSS name"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={eyedrop}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted"
        >
          <Pipette className="h-4 w-4" /> Pick
        </button>
        <div
          className="h-8 w-8 rounded-md border border-border"
          style={{ background: swatch }}
        />
      </div>

      {models && !models.ok && (
        <p role="alert" className="text-sm text-error">
          {models.error}
        </p>
      )}
      {models?.ok && (
        <div className="flex flex-col">
          {(["hex", "rgb", "hsl", "hsv"] as const).map((k) => (
            <div
              key={k}
              className="flex items-baseline gap-3 border-b border-border py-2"
            >
              <span className="w-16 shrink-0 text-xs uppercase text-muted-foreground">
                {k}
              </span>
              <span aria-label={k} className="font-mono text-sm">
                {models.value[k]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border p-3">
        <div className="mb-2 text-xs uppercase text-muted-foreground">
          Contrast checker
        </div>
        <div className="flex items-center gap-3">
          <input
            aria-label="Foreground"
            value={fg}
            onChange={(e) => setFg(e.target.value)}
            className="w-28 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm"
          />
          <input
            aria-label="Background"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            className="w-28 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm"
          />
          <div
            className="rounded px-3 py-1"
            style={{ color: fg, background: bg }}
          >
            Aa
          </div>
          {ratio.ok && (
            <>
              <span aria-label="Contrast ratio" className="font-mono text-sm">
                {ratio.value.toFixed(2)}:1
              </span>
              <Badge ok={wcagLevels(ratio.value).aa} label="AA" />
              <Badge ok={wcagLevels(ratio.value).aaa} label="AAA" />
            </>
          )}
          {!ratio.ok && (
            <span role="alert" className="text-sm text-error">
              {ratio.error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/tools/color/index.ts`**

```ts
import { Palette } from "lucide-react";
import type { Tool } from "@/core/types";
import { parseColor } from "./color";
import ColorTool from "./ColorTool";

export const colorTool: Tool = {
  id: "color",
  name: "Color",
  category: "convert-other",
  icon: Palette,
  keywords: ["color", "colour", "hex", "rgb", "hsl", "contrast", "颜色"],
  component: ColorTool,
  detectClipboard(text: string) {
    return parseColor(text).ok && /^#|rgb|hsl/i.test(text.trim());
  },
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/tools/color/ColorTool.test.tsx`
Expected: PASS — 2 passed (eyedropper is mocked, so no Tauri invoke runs).

- [ ] **Step 7: Commit**

```bash
git add src/tools/color
git commit -m "feat: add Color workspace (conversions + contrast + eyedropper)"
```

---

## Task 13: Register the five Phase-2 tools

**Files:**

- Modify: `src/core/registry.ts`, `src/core/registry.test.ts`

- [ ] **Step 1: Extend the registry test**

```ts
it("contains all Phase-2 tools", () => {
  for (const id of ["xml", "radix", "cron", "regex", "color"]) {
    expect(getTool(id)).toBeDefined();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/registry.test.ts`
Expected: FAIL — `getTool("xml")` is undefined.

- [ ] **Step 3: Update `src/core/registry.ts`**

```ts
import type { Tool } from "./types";
import { jsonTool } from "@/tools/json";
import { base64Tool } from "@/tools/base64";
import { urlTool } from "@/tools/url";
import { timeTool } from "@/tools/time";
import { diffTool } from "@/tools/diff";
import { xmlTool } from "@/tools/xml";
import { radixTool } from "@/tools/radix";
import { cronTool } from "@/tools/cron";
import { regexTool } from "@/tools/regex";
import { colorTool } from "@/tools/color";

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
  return id ? tools.find((t) => t.id === id) : undefined;
}
```

- [ ] **Step 4: Run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all suites pass (the 10 tools' logic + smoke tests, plus core).

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts src/core/registry.test.ts
git commit -m "feat: register XML, Radix, Cron, Regex, Color tools"
```

---

## Task 14: Manual end-to-end verification (macOS)

Interactive — run on macOS with the Rust toolchain.

- [ ] **Step 1: Launch and exercise each tool**

Run: `npm run tauri dev` and confirm:

- Sidebar + ⌘K now list all **10** tools.
- **XML:** paste `<a><b>1</b></a>` → Format indents; malformed input shows a line:col error.
- **Radix:** type `255` (base 10) → bin/oct/dec/hex rows + nibble-grouped bitwise; `zz` shows an error.
- **Cron:** type `0 9 * * 1-5` → "At 09:00 AM, Monday–Friday" and the next 5 runs in local time.
- **Regex:** pattern `\d+` over `a1 b22` highlights matches, shows the count and any groups; clicking a snippet fills the pattern.
- **Color:** type `#ff0000` → hex/rgb/hsl/hsv + swatch; the **Pick** button opens the macOS color sampler and fills the picked hex; the contrast checker shows the ratio and AA/AAA badges.

- [ ] **Step 2: Verify the eyedropper specifically**

Click **Pick** in the Color tool; the macOS magnifier/sampler appears; clicking a screen pixel fills a `#rrggbb` value. If the native sampler fails, confirm the tool still works via manual hex entry (graceful fallback), and capture the `cargo`/console error for follow-up.

- [ ] **Step 3: Commit (only if any fix was needed)**

```bash
git add -A
git commit -m "fix: address issues found during Phase-2 manual verification"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-06-toolkit-design.md` §7 tools 6–10, §12):

| Spec item                                                                    | Covered by                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| XML format/minify + well-formedness validate                                 | Tasks 2, 3                                            |
| Radix bin/oct/dec/hex + arbitrary base 2–36 + BigInt + bitwise view          | Tasks 4, 5                                            |
| Cron → human description + next N runs + field builder (presets)             | Tasks 6, 7                                            |
| Regex live test, match/group highlight, flags + snippet library + cheatsheet | Tasks 8, 9                                            |
| Color hex⇄rgb⇄hsl⇄hsv + contrast checker                                     | Tasks 10, 12                                          |
| Screen eyedropper via Rust NSColorSampler                                    | Tasks 11, 12                                          |
| NL→regex explicitly excluded (snippets instead)                              | Task 8 (snippets only)                                |
| Pure transforms return `{ok,value}\|{ok,error}`                              | Tasks 2, 4, 6, 8, 10                                  |
| Vitest unit + RTL smoke per tool; cargo build for native                     | Tasks 2–13 + Task 11 Step 5                           |
| Reused shared OutputPane/Copy/History/useToolInput                           | Tasks 3 (and Radix/Cron/Regex/Color use shared input) |

**Deferred (Plan 4 / Phase 3):** quick-xml + serde_json Rust fast-paths and the Web Worker pool (XML/JSON run on the main thread here); settings screen; packaging/signing. The eyedropper's exact AppKit binding is flagged as the one residual risk with a graceful JS fallback.

**2. Placeholder scan:** No "TBD"/"similar to Task N"/vague "handle errors". Every code step is complete. The single forward risk (objc2 API drift) is called out with a concrete remediation path and a guaranteed fallback, not left implicit.

**3. Type consistency:** All tools return the shared `ToolResult` from Plan 1 Task 6. `convertRadix(input, fromBase, toBase)` / `toBinaryGroups(value: bigint)` (Task 4) match the RadixTool caller (Task 5). `nextRuns(expr, count, fromMs?, tz)` / `describeCron(expr)` (Task 6) match CronTool (Task 7). `runRegex(pattern, flags, text) → RegexMatch[]` (Task 8) matches RegexTool (Task 9). `parseColor`/`contrastRatio`/`wcagLevels` (Task 10) match ColorTool (Task 12). `pickColor(): Promise<string|null>` (Task 12 Step 1) matches the `pick_color` Rust command (Task 11) signature `() -> Result<String, String>`. Registry array uses each tool's `id` consistently with its `index.ts` definition.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-toolkit-phase-2-tools.md`. Depends on Plans 1 and 2. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session with checkpoints.

**Note:** Task 11 (Rust eyedropper) and Task 14 are native/interactive and must run on macOS with the Rust toolchain. The eyedropper is the one piece likely to need a small version-matching follow-up; everything else is pure JS and fully unit-tested.
