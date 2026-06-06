# ToolKit Tools Batch 2 (Base64 · URL · Time · Diff) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Phase-1 tool set by adding **Base64, URL, Time, Diff**, and complete the cross-cutting wiring Plan 1 deferred: a shared per-tool input so ⌘K **commands** and the clipboard **Fill** can drive the active tool, a reusable **output / copy / history** UI, and clipboard **tool-suggestion**.

**Architecture:** Same plugin model as Plan 1 — each tool is `{ pure logic (unit tested) + workspace component + Tool definition }` registered in the `Tool[]` registry. Per-tool input is lifted into the Zustand store so non-tool surfaces (⌘K palette, clipboard banner) can read/write it via a `ToolContext`. Pure transforms keep returning `{ ok, value } | { ok, error }` and never throw into the UI.

**Tech Stack:** Existing (React 18, TS, Vite, Tailwind v4, shadcn/ui, Zustand, Tauri 2) plus **day.js** (+ utc/timezone/relativeTime/customParseFormat plugins), **diff** (jsdiff) for the testable inline diff, and **@codemirror/merge** for the side-by-side view.

> **Source spec:** `docs/superpowers/specs/2026-06-06-toolkit-design.md`. **Prerequisite:** Plan 1 (`2026-06-06-toolkit-foundation.md`) is fully implemented and committed — this plan extends its store, registry, command palette, and clipboard banner.

> **Scope deferred to later plans (do NOT build here):** XML/Radix/Cron/Regex/Color and the native eyedropper (Plan 3 / Phase 2); Web Worker pool + Rust `serde_json`/`quick-xml` fast-paths, settings screen, packaging/signing (Plan 4 / Phase 3). All four tools here use native/JS libraries only and run on the main thread.

---

## File Structure

| Path                                           | Responsibility                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/core/store.ts`                            | **Modify:** add `toolInputs: Record<string,string>` + `setToolInput(id, text)`           |
| `src/core/store.test.ts`                       | **Modify:** cover `setToolInput`                                                         |
| `src/core/hooks/useToolInput.ts`               | `useToolInput(toolId)` → `[input, setInput]` bound to the store                          |
| `src/components/OutputPane.tsx`                | Shared ok / error(line:col) / empty output renderer                                      |
| `src/components/CopyButton.tsx`                | Copy text via Tauri clipboard; fires `onCopied` (history commit point)                   |
| `src/components/HistoryButton.tsx`             | Popover listing recent entries; click restores input                                     |
| `src/app/CommandPalette.tsx`                   | **Modify:** run a tool's `commands` against its `ToolContext`                            |
| `src/core/hooks/useClipboardDetect.ts`         | **Modify:** also return a `suggestedToolId` when another tool matches                    |
| `src/app/ClipboardBanner.tsx`                  | **Modify:** Fill injects into active tool; "Open in …" for a suggestion                  |
| `src/App.tsx`                                  | **Modify:** wire Fill → `setToolInput(activeToolId, …)` and suggestion → `setActiveTool` |
| `src/tools/json/JsonTool.tsx`                  | **Modify:** use `useToolInput("json")`; add Copy + History                               |
| `src/tools/json/index.ts`                      | **Modify:** add escape/unescape `commands`                                               |
| `src/tools/base64/base64.ts` · `.test.ts`      | Pure encode/decode (UTF-8 safe, URL-safe variant)                                        |
| `src/tools/base64/Base64Tool.tsx` · `index.ts` | Workspace + Tool definition                                                              |
| `src/tools/url/url.ts` · `.test.ts`            | Pure encode/decode + query-string parse                                                  |
| `src/tools/url/UrlTool.tsx` · `index.ts`       | Workspace (incl. query table) + Tool definition                                          |
| `src/tools/time/time.ts` · `.test.ts`          | Pure epoch↔ISO↔custom, timezone, relative                                                |
| `src/tools/time/TimeTool.tsx` · `index.ts`     | Workspace + Tool definition                                                              |
| `src/tools/diff/diff.ts` · `.test.ts`          | Pure line/word/char diff + stats (jsdiff)                                                |
| `src/tools/diff/DiffTool.tsx` · `index.ts`     | Inline diff + CodeMirror merge + Tool definition                                         |
| `src/core/registry.ts`                         | **Modify:** register base64, url, time, diff                                             |

---

## Task 1: Lift per-tool input into the store

So the ⌘K palette and clipboard banner can drive whichever tool is active, input lives in the store keyed by tool id (not in each component's local state).

**Files:**

- Modify: `src/core/store.ts`, `src/core/store.test.ts`
- Create: `src/core/hooks/useToolInput.ts`

- [ ] **Step 1: Extend the store test**

Add to `src/core/store.test.ts` inside the existing `describe("app store", …)` block, and update the `beforeEach` reset to include `toolInputs: {}`:

```ts
// in beforeEach setState:
//   activeToolId: null, favorites: [], theme: "system", toolInputs: {},

it("sets and overwrites a tool's input independently", () => {
  const { setToolInput } = useAppStore.getState();
  setToolInput("json", "{}");
  setToolInput("base64", "aGk=");
  expect(useAppStore.getState().toolInputs).toEqual({
    json: "{}",
    base64: "aGk=",
  });
  setToolInput("json", "[]");
  expect(useAppStore.getState().toolInputs.json).toBe("[]");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/store.test.ts`
Expected: FAIL — `setToolInput is not a function`.

- [ ] **Step 3: Add the slice to `src/core/store.ts`**

Add the fields to `AppState` and the initializer:

```ts
export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  toolInputs: Record<string, string>;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setToolInput: (id: string, text: string) => void;
  hydrate: (
    slice: Partial<Pick<AppState, "favorites" | "theme" | "activeToolId">>,
  ) => void;
}
```

In the `create<AppState>((set) => ({ … }))` body add:

```ts
toolInputs: {},
setToolInput: (id, text) =>
  set((s) => ({ toolInputs: { ...s.toolInputs, [id]: text } })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/store.test.ts`
Expected: PASS — all store tests green.

- [ ] **Step 5: Write `src/core/hooks/useToolInput.ts`**

```ts
import { useCallback } from "react";
import { useAppStore } from "@/core/store";

/** Per-tool input bound to the store, so ⌘K commands and the clipboard
 *  banner can read/write the active tool's input. */
export function useToolInput(toolId: string): [string, (text: string) => void] {
  const value = useAppStore((s) => s.toolInputs[toolId] ?? "");
  const setToolInput = useAppStore((s) => s.setToolInput);
  const set = useCallback(
    (text: string) => setToolInput(toolId, text),
    [toolId, setToolInput],
  );
  return [value, set];
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/store.ts src/core/store.test.ts src/core/hooks/useToolInput.ts
git commit -m "feat: lift per-tool input into the store + useToolInput hook"
```

---

## Task 2: Shared output / copy / history UI

Three small reusable components so every tool renders results, copies output, and restores history the same way (DRY). `CopyButton` uses the Tauri clipboard plugin added in Plan 1.

**Files:**

- Create: `src/components/OutputPane.tsx`, `src/components/CopyButton.tsx`, `src/components/HistoryButton.tsx`

- [ ] **Step 1: Write `src/components/OutputPane.tsx`**

```tsx
import type { ToolResult } from "@/core/types";

/** Renders a ToolResult: success text, inline error with line/col, or an
 *  empty-state hint. Shared by every two-pane tool. */
export function OutputPane({
  result,
  emptyHint,
  label = "Output",
}: {
  result: ToolResult | null;
  emptyHint: string;
  label?: string;
}) {
  return (
    <div className="h-full overflow-auto rounded-md border border-border bg-muted p-3">
      {result?.ok && (
        <pre
          aria-label={label}
          className="font-mono text-sm whitespace-pre-wrap"
        >
          {result.value}
        </pre>
      )}
      {result && !result.ok && (
        <div role="alert" className="font-mono text-sm text-error">
          {result.error}
          {result.line != null && (
            <span>
              {" "}
              (line {result.line}, col {result.col})
            </span>
          )}
        </div>
      )}
      {!result && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/CopyButton.tsx`**

```tsx
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/** Copies `text` to the system clipboard and notifies via `onCopied`
 *  (the natural point to commit a history entry for live-transform tools). */
export function CopyButton({
  text,
  onCopied,
  disabled,
}: {
  text: string;
  onCopied?: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await writeText(text);
      onCopied?.();
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable (e.g. tests) — no-op */
    }
  }

  return (
    <button
      onClick={copy}
      disabled={disabled || !text}
      aria-label="Copy output"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
```

- [ ] **Step 3: Write `src/components/HistoryButton.tsx`**

```tsx
import { useState } from "react";
import { History } from "lucide-react";
import type { HistoryEntry } from "@/core/services/history";

/** Lightweight popover of recent inputs; selecting one restores it. */
export function HistoryButton({
  entries,
  onRestore,
}: {
  entries: HistoryEntry[];
  onRestore: (input: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = (s: string) => (s.length > 48 ? `${s.slice(0, 48)}…` : s);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="History"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
      >
        <History className="h-3.5 w-3.5" /> History
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-border bg-background p-1 shadow-md">
          {entries.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No history yet.
            </p>
          )}
          {entries.map((e) => (
            <button
              key={e.ts}
              onClick={() => {
                onRestore(e.input);
                setOpen(false);
              }}
              className="block w-full truncate rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
            >
              {preview(e.input)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/OutputPane.tsx src/components/CopyButton.tsx src/components/HistoryButton.tsx
git commit -m "feat: add shared OutputPane, CopyButton, HistoryButton components"
```

---

## Task 3: Run ⌘K commands against a tool's ToolContext

Plan 1's palette listed `tool.commands` but `onSelect` only opened the tool. Now selecting a command builds the owning tool's `ToolContext` from the store and runs it.

**Files:**

- Modify: `src/app/CommandPalette.tsx`

- [ ] **Step 1: Update the command branch in `src/app/CommandPalette.tsx`**

Add a `runCommand` helper (uses `getState()` to avoid stale closures) and call it from the actions group's `onSelect`:

```tsx
import type { Tool, ToolCommand } from "@/core/types";

// inside CommandPalette(), alongside `choose`:
const runCommand = (tool: Tool, cmd: ToolCommand) => {
  setActiveTool(tool.id);
  const store = useAppStore.getState();
  cmd.run({
    input: store.toolInputs[tool.id] ?? "",
    setInput: (text: string) => store.setToolInput(tool.id, text),
  });
  setOpen(false);
};
```

Replace the Actions `CommandItem`'s `onSelect={() => choose(tool.id)}` with `onSelect={() => runCommand(tool, cmd)}`. Keep the `value` and key as in Plan 1.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/CommandPalette.tsx
git commit -m "feat: run ⌘K commands against the owning tool's ToolContext"
```

---

## Task 4: Retrofit the JSON tool onto shared input + commands

JSON now reads/writes shared input, gains Copy + History, and surfaces the `escapeJson`/`unescapeJson` functions (already tested in Plan 1 Task 10) as ⌘K commands.

**Files:**

- Modify: `src/tools/json/JsonTool.tsx`, `src/tools/json/index.ts`

- [ ] **Step 1: Update `src/tools/json/JsonTool.tsx`**

Swap local input state for `useToolInput`, render the output through `OutputPane`, and add the Copy + History bar:

```tsx
import { useState } from "react";
import { formatJson, minifyJson, sortJsonKeys } from "./json";
import type { ToolResult } from "@/core/types";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { OutputPane } from "@/components/OutputPane";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";

type Action = (input: string) => ToolResult;

const ACTIONS: { label: string; run: Action }[] = [
  { label: "Format", run: (i) => formatJson(i) },
  { label: "Minify", run: (i) => minifyJson(i) },
  { label: "Sort keys", run: (i) => sortJsonKeys(i) },
];

export default function JsonTool() {
  const [input, setInput] = useToolInput("json");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("json");

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
          aria-label="JSON input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Paste JSON here, e.g. {"hello": "world"}'
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <OutputPane
          result={result}
          emptyHint="Output appears here. Paste JSON and pick an action."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add commands to `src/tools/json/index.ts`**

```ts
import { Braces } from "lucide-react";
import type { Tool } from "@/core/types";
import { formatJson, escapeJson, unescapeJson } from "./json";
import JsonTool from "./JsonTool";

export const jsonTool: Tool = {
  id: "json",
  name: "JSON",
  category: "encode-text",
  icon: Braces,
  keywords: [
    "json",
    "format",
    "pretty",
    "minify",
    "validate",
    "escape",
    "格式化",
  ],
  component: JsonTool,
  detectClipboard(text: string) {
    return formatJson(text).ok;
  },
  commands: [
    {
      id: "escape",
      title: "Escape to JSON string",
      run: (ctx) => {
        const r = escapeJson(ctx.input);
        if (r.ok) ctx.setInput(r.value);
      },
    },
    {
      id: "unescape",
      title: "Unescape JSON string",
      run: (ctx) => {
        const r = unescapeJson(ctx.input);
        if (r.ok) ctx.setInput(r.value);
      },
    },
  ],
};
```

- [ ] **Step 3: Re-run the JSON suite (still green after the refactor)**

Run: `npx vitest run src/tools/json`
Expected: PASS — `json.test.ts` and `JsonTool.test.tsx` still pass. The smoke test sets input via the textarea, which now writes the store; no test change needed. (If the store retains state across tests, add `useAppStore.setState({ toolInputs: {} })` to the test's `beforeEach`.)

- [ ] **Step 4: Commit**

```bash
git add src/tools/json/JsonTool.tsx src/tools/json/index.ts
git commit -m "feat: JSON tool on shared input + copy/history + escape commands"
```

---

## Task 5: Base64 pure transforms (TDD)

UTF-8-safe encode/decode with an optional URL-safe variant.

**Files:**

- Create: `src/tools/base64/base64.ts`, `src/tools/base64/base64.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { encodeBase64, decodeBase64 } from "./base64";

describe("encodeBase64", () => {
  it("encodes ASCII", () => {
    expect(encodeBase64("hi")).toEqual({ ok: true, value: "aGk=" });
  });
  it("is UTF-8 safe", () => {
    expect(encodeBase64("café")).toEqual({ ok: true, value: "Y2Fmw6k=" });
  });
  it("produces the URL-safe variant (no +/ and no padding)", () => {
    const r = encodeBase64("<<???>>", true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toMatch(/[+/=]/);
  });
});

describe("decodeBase64", () => {
  it("round-trips unicode", () => {
    const enc = encodeBase64("café — 中文");
    expect(enc.ok).toBe(true);
    if (enc.ok)
      expect(decodeBase64(enc.value)).toEqual({
        ok: true,
        value: "café — 中文",
      });
  });
  it("decodes the URL-safe variant", () => {
    const enc = encodeBase64("a/b+c", true);
    if (enc.ok)
      expect(decodeBase64(enc.value, true)).toEqual({
        ok: true,
        value: "a/b+c",
      });
  });
  it("errors on empty input", () => {
    expect(decodeBase64("").ok).toBe(false);
  });
  it("errors on non-base64 garbage", () => {
    expect(decodeBase64("!!!not base64!!!").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/base64/base64.test.ts`
Expected: FAIL — cannot find module `./base64`.

- [ ] **Step 3: Write `src/tools/base64/base64.ts`**

```ts
import type { ToolResult } from "@/core/types";

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlSafe(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return b64;
}

export function encodeBase64(input: string, urlSafe = false): ToolResult {
  try {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const b64 = btoa(binary);
    return { ok: true, value: urlSafe ? toUrlSafe(b64) : b64 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function decodeBase64(input: string, urlSafe = false): ToolResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Input is empty" };
  try {
    const binary = atob(urlSafe ? fromUrlSafe(trimmed) : trimmed);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return {
      ok: true,
      value: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return { ok: false, error: "Invalid Base64 input" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/base64/base64.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/base64/base64.ts src/tools/base64/base64.test.ts
git commit -m "feat: add Base64 encode/decode (UTF-8 safe + URL-safe variant)"
```

---

## Task 6: Base64 workspace + Tool definition

Live transform (encode/decode toggle + URL-safe checkbox), shared input, copy + history.

**Files:**

- Create: `src/tools/base64/Base64Tool.tsx`, `src/tools/base64/index.ts`, `src/tools/base64/Base64Tool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import { setStorageBackend, type KV } from "@/core/services/storage";
import Base64Tool from "./Base64Tool";

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

describe("Base64Tool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("encodes input live", () => {
    render(<Base64Tool />);
    fireEvent.change(screen.getByLabelText("Base64 input"), {
      target: { value: "hi" },
    });
    expect(screen.getByLabelText("Output").textContent).toContain("aGk=");
  });

  it("shows an error when decoding garbage", () => {
    render(<Base64Tool />);
    fireEvent.click(screen.getByRole("button", { name: "Decode" }));
    fireEvent.change(screen.getByLabelText("Base64 input"), {
      target: { value: "!!!" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/base64/Base64Tool.test.tsx`
Expected: FAIL — cannot find module `./Base64Tool`.

- [ ] **Step 3: Write `src/tools/base64/Base64Tool.tsx`**

```tsx
import { useMemo, useState } from "react";
import { encodeBase64, decodeBase64 } from "./base64";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useHistory } from "@/core/hooks/useHistory";
import { OutputPane } from "@/components/OutputPane";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";

type Mode = "encode" | "decode";

export default function Base64Tool() {
  const [input, setInput] = useToolInput("base64");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const { entries, record } = useHistory("base64");

  const result = useMemo(() => {
    if (!input) return null;
    return mode === "encode"
      ? encodeBase64(input, urlSafe)
      : decodeBase64(input, urlSafe);
  }, [input, mode, urlSafe]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {(["encode", "decode"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {m}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={urlSafe}
            onChange={(e) => setUrlSafe(e.target.checked)}
          />
          URL-safe
        </label>
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton
            text={result?.ok ? result.value : ""}
            onCopied={() => result?.ok && record(input, result.value)}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <textarea
          aria-label="Base64 input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "encode" ? "Text to encode…" : "Base64 to decode…"
          }
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <OutputPane
          result={result}
          emptyHint="Type or paste on the left to convert."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/base64/index.ts`**

```ts
import { Binary } from "lucide-react";
import type { Tool } from "@/core/types";
import { decodeBase64 } from "./base64";
import Base64Tool from "./Base64Tool";

export const base64Tool: Tool = {
  id: "base64",
  name: "Base64",
  category: "encode-text",
  icon: Binary,
  keywords: ["base64", "encode", "decode", "atob", "btoa", "编码"],
  component: Base64Tool,
  detectClipboard(text: string) {
    const t = text.trim();
    return (
      t.length >= 8 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(t) && decodeBase64(t).ok
    );
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/base64/Base64Tool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/base64
git commit -m "feat: add Base64 workspace and Tool definition"
```

---

## Task 7: URL pure transforms (TDD)

Component vs full encode/decode, plus query-string → table parsing.

**Files:**

- Create: `src/tools/url/url.ts`, `src/tools/url/url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  encodeUrlComponent,
  decodeUrlComponent,
  encodeUrlFull,
  parseQuery,
} from "./url";

describe("URL component encode/decode", () => {
  it("encodes reserved characters", () => {
    expect(encodeUrlComponent("a b&c=d")).toEqual({
      ok: true,
      value: "a%20b%26c%3Dd",
    });
  });
  it("round-trips", () => {
    const enc = encodeUrlComponent("名前=テスト");
    if (enc.ok)
      expect(decodeUrlComponent(enc.value)).toEqual({
        ok: true,
        value: "名前=テスト",
      });
  });
  it("errors on malformed percent-encoding", () => {
    expect(decodeUrlComponent("%E0%A4%A").ok).toBe(false);
  });
});

describe("encodeUrlFull", () => {
  it("preserves URL structure but encodes spaces", () => {
    expect(encodeUrlFull("https://x.com/a b?q=1")).toEqual({
      ok: true,
      value: "https://x.com/a%20b?q=1",
    });
  });
});

describe("parseQuery", () => {
  it("parses a full URL's query into key/value rows", () => {
    expect(parseQuery("https://x.com/p?a=1&b=two")).toEqual({
      ok: true,
      value: [
        { key: "a", value: "1" },
        { key: "b", value: "two" },
      ],
    });
  });
  it("parses a bare query string", () => {
    expect(parseQuery("?x=1&y=2")).toEqual({
      ok: true,
      value: [
        { key: "x", value: "1" },
        { key: "y", value: "2" },
      ],
    });
  });
  it("errors on empty input", () => {
    expect(parseQuery("").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/url/url.test.ts`
Expected: FAIL — cannot find module `./url`.

- [ ] **Step 3: Write `src/tools/url/url.ts`**

```ts
import type { ToolResult } from "@/core/types";

export interface QueryParam {
  key: string;
  value: string;
}

export function encodeUrlComponent(input: string): ToolResult {
  try {
    return { ok: true, value: encodeURIComponent(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function decodeUrlComponent(input: string): ToolResult {
  try {
    return { ok: true, value: decodeURIComponent(input) };
  } catch {
    return { ok: false, error: "Malformed percent-encoding" };
  }
}

export function encodeUrlFull(input: string): ToolResult {
  try {
    return { ok: true, value: encodeURI(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function decodeUrlFull(input: string): ToolResult {
  try {
    return { ok: true, value: decodeURI(input) };
  } catch {
    return { ok: false, error: "Malformed percent-encoding" };
  }
}

export function parseQuery(input: string): ToolResult<QueryParam[]> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Input is empty" };
  try {
    let search = trimmed;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed))
      search = new URL(trimmed).search;
    if (search.startsWith("?")) search = search.slice(1);
    const params = new URLSearchParams(search);
    const value: QueryParam[] = [];
    for (const [key, v] of params) value.push({ key, value: v });
    return { ok: true, value };
  } catch {
    return { ok: false, error: "Could not parse query parameters" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/url/url.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/url/url.ts src/tools/url/url.test.ts
git commit -m "feat: add URL encode/decode + query-string parsing"
```

---

## Task 8: URL workspace + Tool definition

Encode/decode (component & full) live, plus a query-param table for the current input.

**Files:**

- Create: `src/tools/url/UrlTool.tsx`, `src/tools/url/index.ts`, `src/tools/url/UrlTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import { setStorageBackend, type KV } from "@/core/services/storage";
import UrlTool from "./UrlTool";

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

describe("UrlTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("encodes a component live", () => {
    render(<UrlTool />);
    fireEvent.change(screen.getByLabelText("URL input"), {
      target: { value: "a b" },
    });
    expect(screen.getByLabelText("Output").textContent).toContain("a%20b");
  });

  it("shows query parameters as rows", () => {
    render(<UrlTool />);
    fireEvent.change(screen.getByLabelText("URL input"), {
      target: { value: "https://x.com/p?a=1&b=two" },
    });
    expect(screen.getByText("two")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/url/UrlTool.test.tsx`
Expected: FAIL — cannot find module `./UrlTool`.

- [ ] **Step 3: Write `src/tools/url/UrlTool.tsx`**

```tsx
import { useMemo, useState } from "react";
import {
  encodeUrlComponent,
  decodeUrlComponent,
  encodeUrlFull,
  decodeUrlFull,
  parseQuery,
} from "./url";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useHistory } from "@/core/hooks/useHistory";
import { OutputPane } from "@/components/OutputPane";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";

type Op = "encode" | "decode";
type Scope = "component" | "full";

export default function UrlTool() {
  const [input, setInput] = useToolInput("url");
  const [op, setOp] = useState<Op>("encode");
  const [scope, setScope] = useState<Scope>("component");
  const { entries, record } = useHistory("url");

  const result = useMemo(() => {
    if (!input) return null;
    if (op === "encode")
      return scope === "component"
        ? encodeUrlComponent(input)
        : encodeUrlFull(input);
    return scope === "component"
      ? decodeUrlComponent(input)
      : decodeUrlFull(input);
  }, [input, op, scope]);

  const query = useMemo(() => parseQuery(input), [input]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["encode", "decode"] as Op[]).map((o) => (
          <button
            key={o}
            onClick={() => setOp(o)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              op === o
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {o}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        {(["component", "full"] as Scope[]).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              scope === s
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <CopyButton
            text={result?.ok ? result.value : ""}
            onCopied={() => result?.ok && record(input, result.value)}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <textarea
          aria-label="URL input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a URL or text…"
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex min-h-0 flex-col gap-3">
          <OutputPane
            result={result}
            emptyHint="Encoded/decoded output appears here."
          />
          {query.ok && query.value.length > 0 && (
            <div className="overflow-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5">Key</th>
                    <th className="px-3 py-1.5">Value</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {query.value.map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{p.key}</td>
                      <td className="px-3 py-1.5">{p.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/url/index.ts`**

```ts
import { Link } from "lucide-react";
import type { Tool } from "@/core/types";
import UrlTool from "./UrlTool";

export const urlTool: Tool = {
  id: "url",
  name: "URL",
  category: "encode-text",
  icon: Link,
  keywords: ["url", "uri", "encode", "decode", "percent", "query", "参数"],
  component: UrlTool,
  detectClipboard(text: string) {
    const t = text.trim();
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /%[0-9A-Fa-f]{2}/.test(t);
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/url/UrlTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/url
git commit -m "feat: add URL workspace (encode/decode + query table) and Tool definition"
```

---

## Task 9: Time pure transforms (TDD)

day.js with UTC/timezone/relative/custom-parse plugins. All time-relative functions take an explicit base so they are deterministic under test.

**Files:**

- Create: `src/tools/time/time.ts`, `src/tools/time/time.test.ts`
- Install: `dayjs`

- [ ] **Step 1: Install day.js**

Run: `npm install dayjs`
Expected: package added.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  toIso,
  toEpochSeconds,
  toEpochMillis,
  formatCustom,
  convertTimezone,
  relativeFrom,
} from "./time";

describe("toIso", () => {
  it("treats short integers as epoch seconds", () => {
    expect(toIso("0")).toEqual({ ok: true, value: "1970-01-01T00:00:00.000Z" });
  });
  it("treats 13-digit integers as epoch millis", () => {
    expect(toIso("1000")).toEqual({
      ok: true,
      value: "1970-01-01T00:00:01.000Z",
    });
  });
  it("errors on gibberish", () => {
    expect(toIso("not-a-date").ok).toBe(false);
  });
});

describe("epoch conversions", () => {
  it("ISO → epoch seconds", () => {
    expect(toEpochSeconds("1970-01-01T00:00:00Z")).toEqual({
      ok: true,
      value: "0",
    });
  });
  it("ISO → epoch millis", () => {
    expect(toEpochMillis("1970-01-01T00:00:01Z")).toEqual({
      ok: true,
      value: "1000",
    });
  });
});

describe("formatCustom (UTC unless a tz is given)", () => {
  it("formats with a pattern", () => {
    expect(formatCustom("0", "YYYY-MM-DD HH:mm:ss")).toEqual({
      ok: true,
      value: "1970-01-01 00:00:00",
    });
  });
});

describe("convertTimezone", () => {
  it("shifts an instant into a zone", () => {
    expect(convertTimezone("1970-01-01T00:00:00Z", "Asia/Tokyo")).toEqual({
      ok: true,
      value: "1970-01-01 09:00:00",
    });
  });
  it("errors on an unknown zone", () => {
    expect(convertTimezone("0", "Not/AZone").ok).toBe(false);
  });
});

describe("relativeFrom", () => {
  it("describes the past relative to a base instant", () => {
    const r = relativeFrom("0", 3_600_000); // input = epoch 0s, base = +1h
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatch(/ago/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tools/time/time.test.ts`
Expected: FAIL — cannot find module `./time`.

- [ ] **Step 4: Write `src/tools/time/time.ts`**

```ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { ToolResult } from "@/core/types";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

/** Parse an epoch (seconds or millis) or an ISO/date string to a dayjs. */
function parse(input: string): dayjs.Dayjs | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    const ms = trimmed.length >= 13 ? num : num * 1000;
    const d = dayjs(ms);
    return d.isValid() ? d : null;
  }
  const d = dayjs(trimmed);
  return d.isValid() ? d : null;
}

const ERR: ToolResult = { ok: false, error: "Unrecognized date/time input" };

export function toIso(input: string): ToolResult {
  const d = parse(input);
  return d ? { ok: true, value: d.utc().toISOString() } : ERR;
}

export function toEpochSeconds(input: string): ToolResult {
  const d = parse(input);
  return d ? { ok: true, value: String(d.unix()) } : ERR;
}

export function toEpochMillis(input: string): ToolResult {
  const d = parse(input);
  return d ? { ok: true, value: String(d.valueOf()) } : ERR;
}

export function formatCustom(
  input: string,
  pattern: string,
  tz?: string,
): ToolResult {
  const d = parse(input);
  if (!d) return ERR;
  try {
    return { ok: true, value: (tz ? d.tz(tz) : d.utc()).format(pattern) };
  } catch {
    return { ok: false, error: `Unknown timezone: ${tz}` };
  }
}

export function convertTimezone(input: string, tz: string): ToolResult {
  const d = parse(input);
  if (!d) return ERR;
  try {
    return { ok: true, value: d.tz(tz).format("YYYY-MM-DD HH:mm:ss") };
  } catch {
    return { ok: false, error: `Unknown timezone: ${tz}` };
  }
}

export function relativeFrom(input: string, baseMs: number): ToolResult {
  const d = parse(input);
  return d ? { ok: true, value: d.from(dayjs(baseMs)) } : ERR;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/time/time.test.ts`
Expected: PASS — all green.

- [ ] **Step 6: Commit**

```bash
git add src/tools/time/time.ts src/tools/time/time.test.ts package.json package-lock.json
git commit -m "feat: add Time conversions (epoch/ISO/custom/timezone/relative)"
```

---

## Task 10: Time workspace + Tool definition

A single input drives a derived panel: ISO, epoch (s/ms), relative, and a custom-format row with a timezone field. "Now" fills the input. The current instant for "relative"/"now" comes from `Date.now()` in the component (the pure functions stay deterministic).

**Files:**

- Create: `src/tools/time/TimeTool.tsx`, `src/tools/time/index.ts`, `src/tools/time/TimeTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import { setStorageBackend, type KV } from "@/core/services/storage";
import TimeTool from "./TimeTool";

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

describe("TimeTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({ toolInputs: {} });
  });

  it("renders ISO for an epoch input", () => {
    render(<TimeTool />);
    fireEvent.change(screen.getByLabelText("Time input"), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText("ISO 8601").textContent).toContain(
      "1970-01-01T00:00:00.000Z",
    );
  });

  it("fills the current time on Now", () => {
    render(<TimeTool />);
    fireEvent.click(screen.getByRole("button", { name: "Now" }));
    expect(
      (screen.getByLabelText("Time input") as HTMLInputElement).value,
    ).not.toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/time/TimeTool.test.tsx`
Expected: FAIL — cannot find module `./TimeTool`.

- [ ] **Step 3: Write `src/tools/time/TimeTool.tsx`**

```tsx
import { useMemo, useState } from "react";
import {
  toIso,
  toEpochSeconds,
  toEpochMillis,
  formatCustom,
  convertTimezone,
  relativeFrom,
} from "./time";
import type { ToolResult } from "@/core/types";
import { useToolInput } from "@/core/hooks/useToolInput";

function Row({ label, result }: { label: string; result: ToolResult }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border py-2">
      <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">
        {label}
      </span>
      {result.ok ? (
        <span aria-label={label} className="font-mono text-sm">
          {result.value}
        </span>
      ) : (
        <span aria-label={label} className="font-mono text-sm text-error">
          {result.error}
        </span>
      )}
    </div>
  );
}

export default function TimeTool() {
  const [input, setInput] = useToolInput("time");
  const [pattern, setPattern] = useState("YYYY-MM-DD HH:mm:ss");
  const [tz, setTz] = useState("Asia/Singapore");

  const now = Date.now();
  const rows = useMemo(() => {
    if (!input.trim()) return null;
    return {
      iso: toIso(input),
      sec: toEpochSeconds(input),
      ms: toEpochMillis(input),
      rel: relativeFrom(input, now),
      custom: formatCustom(input, pattern),
      zoned: convertTimezone(input, tz),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, pattern, tz]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Time input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Epoch (1700000000), ISO (2024-01-01T00:00:00Z), or a date…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          Now
        </button>
      </div>

      {!rows && (
        <p className="text-sm text-muted-foreground">
          Enter a time above to see conversions.
        </p>
      )}

      {rows && (
        <div className="flex flex-col">
          <Row label="ISO 8601" result={rows.iso} />
          <Row label="Epoch (s)" result={rows.sec} />
          <Row label="Epoch (ms)" result={rows.ms} />
          <Row label="Relative" result={rows.rel} />
          <Row label="Custom" result={rows.custom} />
          <div className="flex items-center gap-2 py-2">
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              aria-label="Format pattern"
              className="w-48 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
            <input
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              aria-label="Timezone"
              placeholder="IANA tz, e.g. Asia/Tokyo"
              className="w-48 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
          </div>
          <Row label={`In ${tz}`} result={rows.zoned} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/tools/time/index.ts`**

```ts
import { Clock } from "lucide-react";
import type { Tool } from "@/core/types";
import { toIso } from "./time";
import TimeTool from "./TimeTool";

export const timeTool: Tool = {
  id: "time",
  name: "Time",
  category: "convert-other",
  icon: Clock,
  keywords: ["time", "timestamp", "epoch", "unix", "iso", "timezone", "时间"],
  component: TimeTool,
  detectClipboard(text: string) {
    const t = text.trim();
    return (/^\d{10}$/.test(t) || /^\d{13}$/.test(t)) && toIso(t).ok;
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/time/TimeTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/time
git commit -m "feat: add Time workspace and Tool definition"
```

---

## Task 11: Diff pure logic (TDD)

jsdiff powers the testable line/word/char diff and the inline view; CodeMirror merge (next task) handles side-by-side.

**Files:**

- Create: `src/tools/diff/diff.ts`, `src/tools/diff/diff.test.ts`
- Install: `diff`, `@types/diff`

- [ ] **Step 1: Install jsdiff**

Run: `npm install diff && npm install -D @types/diff`
Expected: packages added.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeDiff, diffStats } from "./diff";

describe("computeDiff (line)", () => {
  it("marks a changed line as removed + added", () => {
    const parts = computeDiff("a\nb\n", "a\nc\n", "line");
    expect(parts.some((p) => p.removed && p.value.includes("b"))).toBe(true);
    expect(parts.some((p) => p.added && p.value.includes("c"))).toBe(true);
    expect(
      parts.some((p) => !p.added && !p.removed && p.value.includes("a")),
    ).toBe(true);
  });
});

describe("computeDiff (word)", () => {
  it("isolates the inserted word", () => {
    const parts = computeDiff("hello world", "hello brave world", "word");
    expect(parts.some((p) => p.added && p.value.includes("brave"))).toBe(true);
  });
});

describe("diffStats", () => {
  it("counts added and removed parts", () => {
    const parts = computeDiff("a\nb\n", "a\nc\n", "line");
    expect(diffStats(parts)).toEqual({ added: 1, removed: 1 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tools/diff/diff.test.ts`
Expected: FAIL — cannot find module `./diff`.

- [ ] **Step 4: Write `src/tools/diff/diff.ts`**

```ts
import { diffLines, diffWords, diffChars, type Change } from "diff";

export type DiffMode = "line" | "word" | "char";

export interface DiffPart {
  value: string;
  added: boolean;
  removed: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export function computeDiff(a: string, b: string, mode: DiffMode): DiffPart[] {
  const fn =
    mode === "line" ? diffLines : mode === "word" ? diffWords : diffChars;
  return fn(a, b).map((c: Change) => ({
    value: c.value,
    added: Boolean(c.added),
    removed: Boolean(c.removed),
  }));
}

export function diffStats(parts: DiffPart[]): DiffStats {
  return parts.reduce<DiffStats>(
    (acc, p) => {
      if (p.added) acc.added += 1;
      else if (p.removed) acc.removed += 1;
      return acc;
    },
    { added: 0, removed: 0 },
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/diff/diff.test.ts`
Expected: PASS — all green.

- [ ] **Step 6: Commit**

```bash
git add src/tools/diff/diff.ts src/tools/diff/diff.test.ts package.json package-lock.json
git commit -m "feat: add diff pure logic (line/word/char + stats)"
```

---

## Task 12: Diff workspace + Tool definition

Two inputs (A/B). Inline mode renders from `computeDiff` (fully testable in jsdom); side-by-side mode mounts a CodeMirror `MergeView`. The smoke test stays in inline mode so it doesn't depend on CodeMirror layout in jsdom.

**Files:**

- Create: `src/tools/diff/DiffTool.tsx`, `src/tools/diff/index.ts`, `src/tools/diff/DiffTool.test.tsx`
- Install: `@codemirror/merge`, `@codemirror/view`, `@codemirror/state`

- [ ] **Step 1: Install CodeMirror merge**

Run: `npm install @codemirror/merge @codemirror/view @codemirror/state`
Expected: packages added.

- [ ] **Step 2: Write the failing smoke test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/core/store";
import DiffTool from "./DiffTool";

describe("DiffTool", () => {
  beforeEach(() => useAppStore.setState({ toolInputs: {} }));

  it("highlights an added word in inline mode", () => {
    render(<DiffTool />);
    fireEvent.change(screen.getByLabelText("Original (A)"), {
      target: { value: "hello world" },
    });
    fireEvent.change(screen.getByLabelText("Changed (B)"), {
      target: { value: "hello brave world" },
    });
    const added = screen.getByLabelText("Inline diff").querySelector("ins");
    expect(added?.textContent).toContain("brave");
  });

  it("reports +/- counts", () => {
    render(<DiffTool />);
    fireEvent.change(screen.getByLabelText("Original (A)"), {
      target: { value: "a\nb\n" },
    });
    fireEvent.change(screen.getByLabelText("Changed (B)"), {
      target: { value: "a\nc\n" },
    });
    expect(screen.getByLabelText("Diff stats").textContent).toMatch(/\+1/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tools/diff/DiffTool.test.tsx`
Expected: FAIL — cannot find module `./DiffTool`.

- [ ] **Step 4: Write `src/tools/diff/DiffTool.tsx`**

The B input lives in the shared store (`useToolInput("diff")`); A lives in a sibling store key (`"diff:a"`) so both panes survive tool switches and clipboard Fill targets B.

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { computeDiff, diffStats, type DiffMode } from "./diff";
import { useToolInput } from "@/core/hooks/useToolInput";

type View = "inline" | "split";

export default function DiffTool() {
  const [a, setA] = useToolInput("diff:a");
  const [b, setB] = useToolInput("diff");
  const [mode, setMode] = useState<DiffMode>("line");
  const [view, setView] = useState<View>("inline");

  const parts = useMemo(() => computeDiff(a, b, mode), [a, b, mode]);
  const stats = useMemo(() => diffStats(parts), [parts]);

  const mergeHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view !== "split" || !mergeHost.current) return;
    const mv = new MergeView({
      parent: mergeHost.current,
      a: {
        doc: a,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
      b: {
        doc: b,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
    });
    return () => mv.destroy();
  }, [view, a, b]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["line", "word", "char"] as DiffMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {m}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        {(["inline", "split"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              view === v
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted"
            }`}
          >
            {v}
          </button>
        ))}
        <span aria-label="Diff stats" className="ml-auto font-mono text-sm">
          <span className="text-success">+{stats.added}</span>{" "}
          <span className="text-error">−{stats.removed}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ height: 160 }}>
        <textarea
          aria-label="Original (A)"
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="Original…"
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <textarea
          aria-label="Changed (B)"
          value={b}
          onChange={(e) => setB(e.target.value)}
          placeholder="Changed…"
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {view === "inline" ? (
        <pre
          aria-label="Inline diff"
          className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-sm whitespace-pre-wrap"
        >
          {parts.map((p, i) =>
            p.added ? (
              <ins key={i} className="bg-success/20 text-success no-underline">
                {p.value}
              </ins>
            ) : p.removed ? (
              <del key={i} className="bg-error/20 text-error">
                {p.value}
              </del>
            ) : (
              <span key={i}>{p.value}</span>
            ),
          )}
        </pre>
      ) : (
        <div
          ref={mergeHost}
          className="min-h-0 flex-1 overflow-auto rounded-md border border-border"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/tools/diff/index.ts`**

```ts
import { GitCompare } from "lucide-react";
import type { Tool } from "@/core/types";
import DiffTool from "./DiffTool";

export const diffTool: Tool = {
  id: "diff",
  name: "Diff",
  category: "convert-other",
  icon: GitCompare,
  keywords: ["diff", "compare", "merge", "change", "比较"],
  component: DiffTool,
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/tools/diff/DiffTool.test.tsx`
Expected: PASS — 2 passed. (Inline mode never mounts `MergeView`, so jsdom layout is irrelevant.)

- [ ] **Step 7: Commit**

```bash
git add src/tools/diff package.json package-lock.json
git commit -m "feat: add Diff workspace (inline + CodeMirror merge) and Tool definition"
```

---

## Task 13: Register the four tools

**Files:**

- Modify: `src/core/registry.ts`, `src/core/registry.test.ts`

- [ ] **Step 1: Extend the registry test**

Add to `src/core/registry.test.ts`:

```ts
it("contains all Phase-1 tools", () => {
  for (const id of ["json", "base64", "url", "time", "diff"]) {
    expect(getTool(id)).toBeDefined();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/registry.test.ts`
Expected: FAIL — `getTool("base64")` is undefined.

- [ ] **Step 3: Update `src/core/registry.ts`**

```ts
import type { Tool } from "./types";
import { jsonTool } from "@/tools/json";
import { base64Tool } from "@/tools/base64";
import { urlTool } from "@/tools/url";
import { timeTool } from "@/tools/time";
import { diffTool } from "@/tools/diff";

export const tools: Tool[] = [
  jsonTool,
  base64Tool,
  urlTool,
  timeTool,
  diffTool,
];

export function getTool(id: string | null): Tool | undefined {
  return id ? tools.find((t) => t.id === id) : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/registry.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts src/core/registry.test.ts
git commit -m "feat: register Base64, URL, Time, Diff tools"
```

---

## Task 14: Clipboard Fill targets the active tool + suggest a tool

Plan 1's banner was informational. Now Fill writes the active tool's input, and when the active tool doesn't match but another does, the banner offers to open it.

**Files:**

- Modify: `src/core/hooks/useClipboardDetect.ts`, `src/app/ClipboardBanner.tsx`, `src/App.tsx`

- [ ] **Step 1: Update `src/core/hooks/useClipboardDetect.ts`**

Return a `suggestedToolId` (first non-active tool whose `detectClipboard` matches) when the active tool itself doesn't match:

```ts
import { useEffect, useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getTool, tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function useClipboardDetect(): {
  text: string | null;
  suggestedToolId: string | null;
  clear: () => void;
} {
  const activeToolId = useAppStore((s) => s.activeToolId);
  const [text, setText] = useState<string | null>(null);
  const [suggestedToolId, setSuggestedToolId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readText()
      .then((clip) => {
        if (!active) return;
        if (!clip) {
          setText(null);
          setSuggestedToolId(null);
          return;
        }
        const current = getTool(activeToolId);
        if (current?.detectClipboard?.(clip)) {
          setText(clip);
          setSuggestedToolId(null);
          return;
        }
        const match = tools.find(
          (t) => t.id !== activeToolId && t.detectClipboard?.(clip),
        );
        setText(match ? clip : null);
        setSuggestedToolId(match ? match.id : null);
      })
      .catch(() => {
        if (active) {
          setText(null);
          setSuggestedToolId(null);
        }
      });
    return () => {
      active = false;
    };
  }, [activeToolId]);

  return { text, suggestedToolId, clear: () => setText(null) };
}
```

- [ ] **Step 2: Update `src/app/ClipboardBanner.tsx`**

Add an optional "Open in …" action for a suggestion:

```tsx
import { ClipboardPaste, X } from "lucide-react";

export function ClipboardBanner({
  text,
  suggestionName,
  onFill,
  onOpenSuggestion,
  onDismiss,
}: {
  text: string;
  suggestionName?: string;
  onFill: (text: string) => void;
  onOpenSuggestion?: () => void;
  onDismiss: () => void;
}) {
  const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return (
    <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
      <ClipboardPaste className="h-4 w-4 text-primary" strokeWidth={1.75} />
      <span className="flex-1 truncate text-muted-foreground">
        Clipboard: <span className="font-mono">{preview}</span>
      </span>
      {suggestionName ? (
        <button
          onClick={onOpenSuggestion}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          Open in {suggestionName}
        </button>
      ) : (
        <button
          onClick={() => onFill(text)}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          Fill
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire it in `src/App.tsx`**

Replace the clipboard banner block. Pull `activeToolId`, `setToolInput`, `setActiveTool` from the store; resolve the suggested tool's name from the registry:

```tsx
import { getTool } from "@/core/registry";
// …
const {
  text: clipText,
  suggestedToolId,
  clear: clearClip,
} = useClipboardDetect();
const activeToolId = useAppStore((s) => s.activeToolId);
const setToolInput = useAppStore((s) => s.setToolInput);
const setActiveTool = useAppStore((s) => s.setActiveTool);
const suggestionName = getTool(suggestedToolId)?.name;

// …in the JSX, replacing the old <ClipboardBanner …/>:
{
  clipText && (
    <ClipboardBanner
      text={clipText}
      suggestionName={suggestionName}
      onFill={(t) => {
        if (activeToolId) setToolInput(activeToolId, t);
        clearClip();
      }}
      onOpenSuggestion={() => {
        if (suggestedToolId) {
          setActiveTool(suggestedToolId);
          setToolInput(suggestedToolId, clipText);
        }
        clearClip();
      }}
      onDismiss={clearClip}
    />
  );
}
```

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; every suite passes (store, storage, history, registry, json, base64, url, time, diff + component smoke tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/hooks/useClipboardDetect.ts src/app/ClipboardBanner.tsx src/App.tsx
git commit -m "feat: clipboard Fill targets active tool + suggest a matching tool"
```

---

## Task 15: Manual end-to-end verification (macOS)

Interactive — run on macOS with the Rust toolchain (Plan 1 Task 0).

- [ ] **Step 1: Launch and exercise each tool**

Run: `npm run tauri dev` and confirm:

- Sidebar lists **JSON, Base64, URL, Time, Diff**; ⌘K finds each by name/keyword.
- **Base64:** type `café` → output `Y2Fmw6k=`; toggle Decode + paste it back → `café`; URL-safe checkbox changes the output.
- **URL:** paste `https://x.com/p?a=1&b=two` → query table shows two rows; Encode/Decode + component/full toggles work.
- **Time:** type `0` → ISO `1970-01-01T00:00:00.000Z`, epoch rows, relative; **Now** fills the current epoch; changing the timezone field updates the zoned row.
- **Diff:** type into A and B → inline highlights add/remove and the +/− counts update; **split** shows the CodeMirror side-by-side merge.
- **⌘K commands:** open JSON, type a raw string, run **"Escape to JSON string"** from ⌘K → input becomes the quoted literal.
- **Clipboard suggest:** copy `1700000000`, switch to JSON → banner offers **"Open in Time"**; clicking it opens Time pre-filled.
- **History:** run a few conversions, click **History** → recent inputs restore on click.

- [ ] **Step 2: Commit (only if any fix was needed)**

```bash
git add -A
git commit -m "fix: address issues found during batch-2 manual verification"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-06-toolkit-design.md` §7 tools 2–5 and §5 cross-cutting):

| Spec item                                                    | Covered by                                   |
| ------------------------------------------------------------ | -------------------------------------------- |
| Base64 encode/decode, UTF-8-safe, URL-safe variant           | Tasks 5, 6                                   |
| URL encode/decode (component & full) + query-param table     | Tasks 7, 8                                   |
| Time epoch↔ISO↔custom, timezone, relative, now               | Tasks 9, 10                                  |
| Diff line/word/char, side-by-side + inline                   | Tasks 11, 12                                 |
| ⌘K per-tool commands actually run                            | Tasks 3, 4                                   |
| Clipboard smart-detect: fill **or suggest a tool**           | Task 14                                      |
| History one-click restore (UI, not just recording)           | Task 2 (HistoryButton) + wired in 4, 6, 8    |
| Pure transforms return `{ok,value}\|{ok,error}`, never throw | Tasks 5, 7, 9, 11                            |
| Inline error with location; editable input; no crashes       | Task 2 (OutputPane) used in 4, 6, 8          |
| Vitest unit tests + RTL smoke per tool                       | Tasks 5–12                                   |
| Empty states / helpful hints                                 | OutputPane `emptyHint`, Time/Diff empty copy |

**Deferred (tracked for later plans):** XML/Radix/Cron/Regex/Color + native eyedropper (Plan 3); worker pool, Rust fast-paths, settings, packaging (Plan 4). The Time tool's relative/now read `Date.now()` in the component by design; the pure functions take an explicit base and stay deterministic.

**2. Placeholder scan:** No "TBD"/"similar to Task N"/"add error handling". Every code step is complete. The one cross-task dependency (shared `toolInputs` store slice) is created in Task 1 before any consumer.

**3. Type consistency:** `ToolResult`, `Tool`, `ToolContext` are reused unchanged from Plan 1 Task 6. `useToolInput(id) → [string, (t)=>void]` is consumed identically in Tasks 4, 6, 8, 10, 12. `setToolInput(id, text)` matches store (Task 1), palette (Task 3), and App (Task 14). `computeDiff(a, b, mode)` / `diffStats(parts)` signatures (Task 11) match the DiffTool caller (Task 12). `OutputPane({result, emptyHint, label})`, `CopyButton({text, onCopied})`, `HistoryButton({entries, onRestore})` (Task 2) match every call site. `HistoryEntry` shape (`{input, output, ts}`) reused from Plan 1 Task 9.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-toolkit-tools-batch-2.md`. Depends on Plan 1 being implemented first. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

**Note:** Task 15 (and any `npm run tauri dev` step) is interactive/native and needs macOS with the Rust toolchain.
