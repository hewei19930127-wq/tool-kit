# ToolKit Phase 3 Polish (Worker Pool · Rust Fast-Paths · Settings · Packaging) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Phase-3 polish layer: keep the UI thread free by routing heavy transforms to a **Web Worker** and very large inputs to **Rust fast-paths** (serde_json / quick-xml), add a **Settings screen** (theme + configurable global hotkey), and produce a **packaged, ad-hoc-signed** macOS build.

**Architecture:** A single size-based router (`runTransform`) decides per call whether a transform runs on the **main thread** (small), in a **Web Worker** (heavy), or via a **Rust command** (very large, ≥ ~1 MB). The transform logic stays the pure functions from Plans 1–3; the worker imports them directly, and the Rust path mirrors them with serde_json/quick-xml. Settings is a non-tool view mounted by the shell; the hotkey change re-registers through a Rust command.

**Tech Stack:** Existing stack + Vite module workers, Rust `serde_json` (`preserve_order` feature) and `quick-xml` for fast-paths, `@tauri-apps/api/core` `invoke`, and the Tauri bundler (`tauri build`) for packaging.

> **Source spec:** `docs/superpowers/specs/2026-06-06-toolkit-design.md` §10 (performance budget), §11 (Phase 3), §5 (global hotkey configurable), §12 (thresholds tuned in Phase 3). **Prerequisite:** Plans 1–3 implemented and committed — this plan routes the JSON (Plan 1) and XML (Plan 3) transforms.

> **In scope:** worker pool, JSON+XML Rust fast-paths, settings (theme + hotkey), ad-hoc packaging. **Out of scope:** any new tools, cloud sync, notarization for public distribution (spec §2 non-goals — ad-hoc/self-signed is enough for personal use).

---

## File Structure

| Path                                                     | Responsibility                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/core/services/transform/transforms.ts` · `.test.ts` | Op-name → pure transform registry (json/xml)                         |
| `src/core/services/transform/worker.ts`                  | Web Worker entry: runs a transform by op name                        |
| `src/core/services/transform/pool.ts`                    | `runInWorker(op, input, opts)` — worker lifecycle + promise map      |
| `src/core/services/transform/rust.ts`                    | `runRust(op, …)` — invoke the Rust fast-path command                 |
| `src/core/services/transform/route.ts` · `.test.ts`      | `chooseRoute(len)` + `runTransform(op, input, opts, deps)`           |
| `src/core/hooks/useTransform.ts`                         | Hook wiring `runTransform` with real worker/rust deps + pending flag |
| `src/tools/json/JsonTool.tsx`                            | **Modify:** route actions through `useTransform`; loading indicator  |
| `src/tools/xml/XmlTool.tsx`                              | **Modify:** route actions through `useTransform`; loading indicator  |
| `src-tauri/src/fastpath.rs`                              | `json_format` / `json_minify` / `xml_format` / `xml_minify` commands |
| `src-tauri/src/settings.rs`                              | `set_hotkey` command (re-register global shortcut)                   |
| `src-tauri/src/lib.rs`                                   | **Modify:** register the new commands; mod declarations              |
| `src-tauri/Cargo.toml`                                   | **Modify:** `serde_json` (preserve_order), `quick-xml`, `serde`      |
| `src-tauri/tauri.conf.json`                              | **Modify:** bundle config for packaging                              |
| `src/core/store.ts` · `store.test.ts`                    | **Modify:** add `hotkey` + `setHotkey`                               |
| `src/app/Settings.tsx`                                   | Settings view (theme radio + hotkey field)                           |
| `src/app/Sidebar.tsx`                                    | **Modify:** footer gear button → open Settings                       |
| `src/App.tsx`                                            | **Modify:** mount Settings; persist + apply `hotkey`; ⌘, shortcut    |

---

## Task 1: Transform registry (pure, TDD)

A flat map from op name to the existing pure transforms, shared by the worker and the main-thread path.

**Files:**

- Create: `src/core/services/transform/transforms.ts`, `src/core/services/transform/transforms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { TRANSFORMS } from "./transforms";

describe("TRANSFORMS registry", () => {
  it("formats JSON via the json.format op", () => {
    expect(TRANSFORMS["json.format"]('{"b":1}')).toEqual({
      ok: true,
      value: '{\n  "b": 1\n}',
    });
  });
  it("minifies XML via the xml.minify op", () => {
    const r = TRANSFORMS["xml.minify"]("<a>\n  <b>1</b>\n</a>");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toContain("\n");
  });
  it("honours an indent option", () => {
    const r = TRANSFORMS["json.format"]('{"a":1}', { indent: 4 });
    if (r.ok) expect(r.value).toBe('{\n    "a": 1\n}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/services/transform/transforms.test.ts`
Expected: FAIL — cannot find module `./transforms`.

- [ ] **Step 3: Write `src/core/services/transform/transforms.ts`**

```ts
import type { ToolResult } from "@/core/types";
import { formatJson, minifyJson, sortJsonKeys } from "@/tools/json/json";
import { formatXml, minifyXml } from "@/tools/xml/xml";

export interface TransformOpts {
  indent?: number;
}

export type TransformFn = (input: string, opts?: TransformOpts) => ToolResult;

/** Heavy, worth-offloading transforms keyed by `tool.action`. */
export const TRANSFORMS: Record<string, TransformFn> = {
  "json.format": (i, o) => formatJson(i, o?.indent ?? 2),
  "json.minify": (i) => minifyJson(i),
  "json.sortKeys": (i, o) => sortJsonKeys(i, o?.indent ?? 2),
  "xml.format": (i, o) => formatXml(i, o?.indent ?? 2),
  "xml.minify": (i) => minifyXml(i),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/services/transform/transforms.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/transform/transforms.ts src/core/services/transform/transforms.test.ts
git commit -m "feat: add transform registry (json/xml ops)"
```

---

## Task 2: Web Worker entry + pool

The worker imports the registry and runs a transform by op name; the pool manages one persistent worker and resolves per-message promises.

**Files:**

- Create: `src/core/services/transform/worker.ts`, `src/core/services/transform/pool.ts`

- [ ] **Step 1: Write `src/core/services/transform/worker.ts`**

```ts
/// <reference lib="webworker" />
import { TRANSFORMS, type TransformOpts } from "./transforms";
import type { ToolResult } from "@/core/types";

interface Req {
  id: number;
  op: string;
  input: string;
  opts?: TransformOpts;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, op, input, opts } = e.data;
  const fn = TRANSFORMS[op];
  const result: ToolResult = fn
    ? fn(input, opts)
    : { ok: false, error: `Unknown transform: ${op}` };
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};
```

- [ ] **Step 2: Write `src/core/services/transform/pool.ts`**

```ts
import type { ToolResult } from "@/core/types";
import type { TransformOpts } from "./transforms";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: ToolResult) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      e: MessageEvent<{ id: number; result: ToolResult }>,
    ) => {
      const { id, result } = e.data;
      pending.get(id)?.(result);
      pending.delete(id);
    };
  }
  return worker;
}

/** Run a registered transform off the main thread. */
export function runInWorker(
  op: string,
  input: string,
  opts?: TransformOpts,
): Promise<ToolResult> {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    getWorker().postMessage({ id, op, input, opts });
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Vite resolves the `new URL("./worker.ts", import.meta.url)` worker at build time; the pool is exercised in the Task 4 manual verification.)

- [ ] **Step 4: Commit**

```bash
git add src/core/services/transform/worker.ts src/core/services/transform/pool.ts
git commit -m "feat: add Web Worker pool for heavy transforms"
```

---

## Task 3: Size-based router (TDD)

`chooseRoute` is a pure threshold decision; `runTransform` dispatches to main/worker/rust via injectable deps so it tests without a real worker or Tauri.

**Files:**

- Create: `src/core/services/transform/route.ts`, `src/core/services/transform/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { chooseRoute, runTransform, type RouteDeps } from "./route";

describe("chooseRoute", () => {
  const opts = { workerAt: 50_000, rustAt: 1_000_000 };
  it("stays on the main thread for small inputs", () => {
    expect(chooseRoute(100, opts)).toBe("main");
  });
  it("uses the worker at the worker threshold", () => {
    expect(chooseRoute(50_000, opts)).toBe("worker");
  });
  it("uses rust at the rust threshold", () => {
    expect(chooseRoute(1_000_000, opts)).toBe("rust");
  });
});

describe("runTransform", () => {
  const baseDeps = (route: "main" | "worker" | "rust"): RouteDeps => ({
    chooseRoute: () => route,
    worker: vi.fn(async () => ({ ok: true, value: "worker" }) as const),
    rust: vi.fn(async () => ({ ok: true, value: "rust" }) as const),
  });

  it("runs small inputs synchronously from the registry", async () => {
    const deps = baseDeps("main");
    const r = await runTransform("json.minify", '{"a": 1}', undefined, deps);
    expect(r).toEqual({ ok: true, value: '{"a":1}' });
    expect(deps.worker).not.toHaveBeenCalled();
  });

  it("offloads to the worker when routed there", async () => {
    const deps = baseDeps("worker");
    const r = await runTransform(
      "json.format",
      "x".repeat(60_000),
      undefined,
      deps,
    );
    expect(r).toEqual({ ok: true, value: "worker" });
  });

  it("uses rust when routed and a rust path exists", async () => {
    const deps = baseDeps("rust");
    const r = await runTransform(
      "json.format",
      "x".repeat(2_000_000),
      undefined,
      deps,
    );
    expect(r).toEqual({ ok: true, value: "rust" });
  });

  it("falls back to the worker when routed to rust but no rust path exists", async () => {
    const deps = baseDeps("rust");
    const r = await runTransform(
      "json.sortKeys",
      "x".repeat(2_000_000),
      undefined,
      deps,
    );
    expect(r).toEqual({ ok: true, value: "worker" });
    expect(deps.rust).not.toHaveBeenCalled();
  });

  it("errors for an unknown op", async () => {
    const r = await runTransform("nope.op", "x", undefined, baseDeps("main"));
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/services/transform/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write `src/core/services/transform/route.ts`**

```ts
import type { ToolResult } from "@/core/types";
import { TRANSFORMS, type TransformOpts } from "./transforms";

export type Route = "main" | "worker" | "rust";

export interface RouteThresholds {
  workerAt: number;
  rustAt: number;
}

export const DEFAULT_THRESHOLDS: RouteThresholds = {
  workerAt: 50_000,
  rustAt: 1_000_000,
};

/** Ops that have a Rust fast-path command (see fastpath.rs). */
export const RUST_OPS = new Set([
  "json.format",
  "json.minify",
  "xml.format",
  "xml.minify",
]);

export function chooseRoute(
  length: number,
  t: RouteThresholds = DEFAULT_THRESHOLDS,
): Route {
  if (length >= t.rustAt) return "rust";
  if (length >= t.workerAt) return "worker";
  return "main";
}

export interface RouteDeps {
  chooseRoute: (length: number) => Route;
  worker: (
    op: string,
    input: string,
    opts?: TransformOpts,
  ) => Promise<ToolResult>;
  rust: (
    op: string,
    input: string,
    opts?: TransformOpts,
  ) => Promise<ToolResult>;
}

export async function runTransform(
  op: string,
  input: string,
  opts: TransformOpts | undefined,
  deps: RouteDeps,
): Promise<ToolResult> {
  const fn = TRANSFORMS[op];
  if (!fn) return { ok: false, error: `Unknown transform: ${op}` };
  const route = deps.chooseRoute(input.length);
  if (route === "rust" && RUST_OPS.has(op)) return deps.rust(op, input, opts);
  if (route !== "main") return deps.worker(op, input, opts);
  return fn(input, opts);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/services/transform/route.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/transform/route.ts src/core/services/transform/route.test.ts
git commit -m "feat: add size-based transform router (main/worker/rust)"
```

---

## Task 4: Route JSON + XML tools through the router

Add the real-deps hook and switch the two heavy tools to async transforms with an inline pending indicator (spec §6 UX must: progress for ops > 300 ms).

**Files:**

- Create: `src/core/services/transform/rust.ts`, `src/core/hooks/useTransform.ts`
- Modify: `src/tools/json/JsonTool.tsx`, `src/tools/xml/XmlTool.tsx`

- [ ] **Step 1: Write `src/core/services/transform/rust.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import type { ToolResult } from "@/core/types";
import type { TransformOpts } from "./transforms";

const RUST_CMD: Record<string, string> = {
  "json.format": "json_format",
  "json.minify": "json_minify",
  "xml.format": "xml_format",
  "xml.minify": "xml_minify",
};

export async function runRust(
  op: string,
  input: string,
  opts?: TransformOpts,
): Promise<ToolResult> {
  const cmd = RUST_CMD[op];
  if (!cmd) return { ok: false, error: `No Rust fast-path for ${op}` };
  try {
    const value = await invoke<string>(cmd, {
      input,
      indent: opts?.indent ?? 2,
    });
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Write `src/core/hooks/useTransform.ts`**

```ts
import { useCallback, useState } from "react";
import type { ToolResult } from "@/core/types";
import {
  runTransform,
  chooseRoute,
  type RouteDeps,
} from "@/core/services/transform/route";
import { runInWorker } from "@/core/services/transform/pool";
import { runRust } from "@/core/services/transform/rust";
import type { TransformOpts } from "@/core/services/transform/transforms";

const browserDeps: RouteDeps = {
  chooseRoute: (len) => chooseRoute(len),
  worker: runInWorker,
  rust: runRust,
};

/** Runs a registered transform with the real worker/rust routing and tracks a pending flag. */
export function useTransform() {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (
      op: string,
      input: string,
      opts?: TransformOpts,
    ): Promise<ToolResult> => {
      setPending(true);
      try {
        return await runTransform(op, input, opts, browserDeps);
      } finally {
        setPending(false);
      }
    },
    [],
  );
  return { run, pending };
}
```

- [ ] **Step 3: Update `src/tools/json/JsonTool.tsx`**

Replace the synchronous `apply` with a routed async version. Actions now reference op names:

```tsx
import { useState } from "react";
import { escapeJson, unescapeJson } from "./json"; // still used by index.ts commands
import type { ToolResult } from "@/core/types";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useTransform } from "@/core/hooks/useTransform";
import { OutputPane } from "@/components/OutputPane";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";

const ACTIONS: { label: string; op: string }[] = [
  { label: "Format", op: "json.format" },
  { label: "Minify", op: "json.minify" },
  { label: "Sort keys", op: "json.sortKeys" },
];

export default function JsonTool() {
  const [input, setInput] = useToolInput("json");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("json");
  const { run, pending } = useTransform();

  async function apply(op: string) {
    const r = await run(op, input);
    setResult(r);
    if (r.ok) record(input, r.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.op}
            onClick={() => apply(a.op)}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
        {pending && (
          <span className="text-xs text-muted-foreground">Working…</span>
        )}
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

> The `escapeJson`/`unescapeJson` import keeps the file's named exports available to the ⌘K commands in `index.ts` (Plan 2 Task 4); those are cheap and stay synchronous, not routed.

- [ ] **Step 4: Update `src/tools/xml/XmlTool.tsx`**

Switch its actions to routed ops the same way:

```tsx
import { useState } from "react";
import { validateXml } from "./xml";
import type { ToolResult } from "@/core/types";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useHistory } from "@/core/hooks/useHistory";
import { useTransform } from "@/core/hooks/useTransform";
import { OutputPane } from "@/components/OutputPane";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";

export default function XmlTool() {
  const [input, setInput] = useToolInput("xml");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { entries, record } = useHistory("xml");
  const { run, pending } = useTransform();

  async function applyOp(op: string) {
    const r = await run(op, input);
    setResult(r);
    if (r.ok) record(input, r.value);
  }

  function validate() {
    setResult(validateXml(input)); // cheap, stays on the main thread
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => applyOp("xml.format")}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Format
        </button>
        <button
          onClick={() => applyOp("xml.minify")}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Minify
        </button>
        <button
          onClick={validate}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Validate
        </button>
        {pending && (
          <span className="text-xs text-muted-foreground">Working…</span>
        )}
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

- [ ] **Step 5: Update the JSON/XML smoke tests for async actions**

In `src/tools/json/JsonTool.test.tsx` and `src/tools/xml/XmlTool.test.tsx`, the format/minify clicks are now async. Wrap the assertion in `findBy*` (which awaits). Example for JSON:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
// …
it("formats input on Format", async () => {
  render(<JsonTool />);
  fireEvent.change(screen.getByLabelText("JSON input"), {
    target: { value: '{"b":1,"a":2}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "Format" }));
  const output = await screen.findByLabelText("Output");
  expect(output.textContent).toContain('"b": 1');
});
```

Apply the same `await screen.findBy…` pattern to the XML format test. With small inputs `chooseRoute` returns `"main"`, so the registry runs synchronously inside the awaited promise — no worker/Tauri needed in jsdom.

- [ ] **Step 6: Run the JSON + XML suites**

Run: `npx vitest run src/tools/json src/tools/xml`
Expected: PASS — async smoke tests green.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/transform/rust.ts src/core/hooks/useTransform.ts src/tools/json/JsonTool.tsx src/tools/json/JsonTool.test.tsx src/tools/xml/XmlTool.tsx src/tools/xml/XmlTool.test.tsx
git commit -m "feat: route JSON/XML transforms through worker/rust with pending state"
```

---

## Task 5: Rust fast-path commands (serde_json + quick-xml)

Mirror the JSON/XML format/minify in Rust for very large inputs.

**Files:**

- Create: `src-tauri/src/fastpath.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Add crates to `src-tauri/Cargo.toml`**

Under `[dependencies]`:

```toml
serde = { version = "1", features = ["derive"] }
serde_json = { version = "1", features = ["preserve_order"] }
quick-xml = "0.36"
```

(`serde`/`serde_json` are already transitive via Tauri; declaring them here with `preserve_order` keeps JSON key order on reformat.)

- [ ] **Step 2: Write `src-tauri/src/fastpath.rs`**

```rust
use serde::Serialize;

#[tauri::command]
pub fn json_format(input: String, indent: usize) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    let pad = " ".repeat(indent);
    let formatter = serde_json::ser::PrettyFormatter::with_indent(pad.as_bytes());
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
    value.serialize(&mut ser).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn json_minify(input: String) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
    serde_json::to_string(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn xml_format(input: String, indent: usize) -> Result<String, String> {
    use quick_xml::events::Event;
    use quick_xml::{Reader, Writer};
    let mut reader = Reader::from_str(&input);
    reader.config_mut().trim_text(true);
    let mut writer = Writer::new_with_indent(Vec::new(), b' ', indent);
    loop {
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Ok(e) => writer.write_event(e).map_err(|e| e.to_string())?,
            Err(e) => return Err(format!("XML error at {}: {}", reader.buffer_position(), e)),
        }
    }
    String::from_utf8(writer.into_inner()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn xml_minify(input: String) -> Result<String, String> {
    use quick_xml::events::Event;
    use quick_xml::{Reader, Writer};
    let mut reader = Reader::from_str(&input);
    reader.config_mut().trim_text(true);
    let mut writer = Writer::new(Vec::new());
    loop {
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Ok(e) => writer.write_event(e).map_err(|e| e.to_string())?,
            Err(e) => return Err(format!("XML error at {}: {}", reader.buffer_position(), e)),
        }
    }
    String::from_utf8(writer.into_inner()).map_err(|e| e.to_string())
}
```

> **Risk note:** quick-xml's reader-config API moved to `Config` around 0.31; this uses the 0.36 form `reader.config_mut().trim_text(true)`. If the build fails on that line, run `cargo doc -p quick-xml --open` and match the installed version's API. The JS `runRust` (Task 4) catches any error and the router falls back to the worker, so a quick-xml hiccup never breaks the tool.

- [ ] **Step 3: Register in `src-tauri/src/lib.rs`**

Add `mod fastpath;` and extend the existing `invoke_handler` list (it already includes `eyedropper::pick_color` from Plan 3):

```rust
mod fastpath;

// merge into the generate_handler! list:
.invoke_handler(tauri::generate_handler![
    eyedropper::pick_color,
    fastpath::json_format,
    fastpath::json_minify,
    fastpath::xml_format,
    fastpath::xml_minify,
])
```

- [ ] **Step 4: Build the Rust side**

Run: `cd src-tauri && cargo build && cd ..`
Expected: compiles. If `quick-xml` fails on `config_mut`, apply the Step-2 risk note.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/fastpath.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add serde_json + quick-xml fast-path commands"
```

---

## Task 6: Settings store slice (TDD)

Persist the configurable global hotkey alongside theme/favorites.

**Files:**

- Modify: `src/core/store.ts`, `src/core/store.test.ts`

- [ ] **Step 1: Extend the store test**

Add the field to `beforeEach` (`hotkey: "Alt+Space"`) and a case:

```ts
it("updates the hotkey", () => {
  useAppStore.getState().setHotkey("Alt+Shift+Space");
  expect(useAppStore.getState().hotkey).toBe("Alt+Shift+Space");
});
```

Also extend the existing `hydrate` test to accept a hotkey:

```ts
it("hydrates the hotkey", () => {
  useAppStore.getState().hydrate({ hotkey: "Control+Space" });
  expect(useAppStore.getState().hotkey).toBe("Control+Space");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/store.test.ts`
Expected: FAIL — `setHotkey is not a function`.

- [ ] **Step 3: Update `src/core/store.ts`**

Add `hotkey` to state, the setter, and widen `hydrate`'s slice:

```ts
export const DEFAULT_HOTKEY = "Alt+Space";

export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  hotkey: string;
  toolInputs: Record<string, string>;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setHotkey: (hotkey: string) => void;
  setToolInput: (id: string, text: string) => void;
  hydrate: (
    slice: Partial<
      Pick<AppState, "favorites" | "theme" | "activeToolId" | "hotkey">
    >,
  ) => void;
}
```

In the initializer add:

```ts
hotkey: DEFAULT_HOTKEY,
setHotkey: (hotkey) => set({ hotkey }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/store.test.ts`
Expected: PASS — all store tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/store.ts src/core/store.test.ts
git commit -m "feat: add configurable hotkey to the store"
```

---

## Task 7: Rust `set_hotkey` command

Re-register the global shortcut from a new accelerator. The handler from Plan 1 fires for whatever is registered, so re-registering is enough.

**Files:**

- Create: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write `src-tauri/src/settings.rs`**

```rust
use std::str::FromStr;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[tauri::command]
pub fn set_hotkey(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    let shortcut = Shortcut::from_str(&accelerator).map_err(|e| e.to_string())?;
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;
    gs.register(shortcut).map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Register in `src-tauri/src/lib.rs`**

Add `mod settings;` and append `settings::set_hotkey` to the `generate_handler!` list from Task 5:

```rust
mod settings;

.invoke_handler(tauri::generate_handler![
    eyedropper::pick_color,
    fastpath::json_format,
    fastpath::json_minify,
    fastpath::xml_format,
    fastpath::xml_minify,
    settings::set_hotkey,
])
```

- [ ] **Step 3: Build**

Run: `cd src-tauri && cargo build && cd ..`
Expected: compiles. (`Shortcut::from_str` parses accelerators like `"Alt+Space"`, `"CmdOrCtrl+Shift+K"`.)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/settings.rs src-tauri/src/lib.rs
git commit -m "feat: add set_hotkey command to re-register the global shortcut"
```

---

## Task 8: Settings screen + shell wiring

A non-tool view with theme radios and a hotkey field; opened from a sidebar gear or ⌘,. Persist + apply on change and on boot.

**Files:**

- Create: `src/app/Settings.tsx`
- Modify: `src/app/Sidebar.tsx`, `src/App.tsx`

- [ ] **Step 1: Write `src/app/Settings.tsx`**

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, type ThemeMode } from "@/core/store";

const THEMES: ThemeMode[] = ["system", "light", "dark"];

export function Settings({ onClose }: { onClose: () => void }) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const hotkey = useAppStore((s) => s.hotkey);
  const setHotkey = useAppStore((s) => s.setHotkey);
  const [draft, setDraft] = useState(hotkey);
  const [status, setStatus] = useState<string | null>(null);

  async function applyHotkey() {
    try {
      await invoke("set_hotkey", { accelerator: draft });
      setHotkey(draft);
      setStatus("Saved");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Could not register that shortcut",
      );
    }
  }

  return (
    <main className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-sm font-medium">Settings</h1>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </header>
      <div className="flex flex-col gap-6 p-6">
        <section>
          <div className="mb-2 text-xs uppercase text-muted-foreground">
            Appearance
          </div>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                  theme === t
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs uppercase text-muted-foreground">
            Global hotkey
          </div>
          <div className="flex items-center gap-2">
            <input
              aria-label="Hotkey"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Alt+Space, CmdOrCtrl+Shift+K"
              className="w-64 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={applyHotkey}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
            {status && (
              <span className="text-xs text-muted-foreground">{status}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use Tauri accelerator syntax (modifiers + key, joined with “+”).
          </p>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add a gear button to `src/app/Sidebar.tsx`**

Accept an `onOpenSettings` prop and render a footer button:

```tsx
import { Settings as SettingsIcon, Star } from "lucide-react";
// change the signature:
export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  // …existing body unchanged, then before the closing </nav>:
}
```

Inside the `<nav>`, after `{rest.map(Row)}`, add:

```tsx
<button
  onClick={onOpenSettings}
  className="mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
>
  <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
  Settings
</button>
```

(Add `mt-auto` works because the `<nav>` is already a `flex flex-col`.)

- [ ] **Step 3: Mount Settings + apply persisted hotkey in `src/App.tsx`**

Add a `settingsOpen` state, a ⌘, shortcut, render Settings instead of DetailHost when open, persist `hotkey`, and apply the stored hotkey on boot:

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings } from "@/app/Settings";
// …

// in App():
const [settingsOpen, setSettingsOpen] = useState(false);

// ⌘, opens settings
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "," && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setSettingsOpen(true);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);

// extend the boot hydration Promise.all to include hotkey, then apply it:
// Promise.all([... , storage().get<string>("hotkey")]).then(([favorites, theme, hotkey]) => {
//   hydrate({ ...(favorites ? { favorites } : {}), ...(theme ? { theme } : {}), ...(hotkey ? { hotkey } : {}) });
//   if (hotkey) invoke("set_hotkey", { accelerator: hotkey }).catch(() => {});
//   setReady(true);
// });

// extend the persist subscription to also save hotkey:
// useAppStore.subscribe((s) => {
//   void storage().set("favorites", s.favorites);
//   void storage().set("theme", s.theme);
//   void storage().set("hotkey", s.hotkey);
// });
```

And in the JSX, swap the detail area:

```tsx
<Sidebar onOpenSettings={() => setSettingsOpen(true)} />
<div className="flex min-w-0 flex-1 flex-col">
  {clipText && (/* …existing ClipboardBanner from Plan 2 Task 14… */ null)}
  {settingsOpen ? <Settings onClose={() => setSettingsOpen(false)} /> : <DetailHost />}
</div>
```

> Keep the existing ClipboardBanner block from Plan 2 — only the `Sidebar` prop and the `settingsOpen ? <Settings/> : <DetailHost/>` swap are new here.

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; every suite passes. (Settings/Sidebar have no new unit tests — they are verified manually in Task 9, consistent with the design's manual-verification-for-native/UI-shell approach.)

- [ ] **Step 5: Commit**

```bash
git add src/app/Settings.tsx src/app/Sidebar.tsx src/App.tsx
git commit -m "feat: add settings screen (theme + configurable hotkey)"
```

---

## Task 9: Manual verification — worker, fast-paths, settings (macOS)

Interactive — run on macOS with the Rust toolchain.

- [ ] **Step 1: Verify routing + responsiveness**

Run: `npm run tauri dev` and confirm:

- **Small JSON** (a few lines) → Format is instant; no "Working…" flash.
- **Large JSON** (paste/generate ~200 KB) → "Working…" appears briefly; the UI stays responsive (you can scroll/type) — confirms the **worker** path.
- **Very large JSON** (~2 MB) → Format still completes; this exercises the **Rust** `json_format` path (set DevTools Network/console logging or temporarily `console.log(chooseRoute(input.length))` to confirm `"rust"`). Output matches the small-input formatting.
- **XML** Format/Minify behave the same across sizes.

- [ ] **Step 2: Verify settings**

- Open **Settings** via the sidebar gear and via **⌘,**.
- Switch theme system/light/dark → the app updates immediately; relaunch keeps the choice.
- Change the hotkey to e.g. `Alt+Shift+Space`, click **Apply** → the old ⌥Space no longer toggles; the new combo does. Relaunch → the persisted hotkey is applied on boot.
- Enter an invalid accelerator (e.g. `Foo+Bar`) → an inline error shows; the previous hotkey keeps working.

- [ ] **Step 3: Commit (only if a fix was needed)**

```bash
git add -A
git commit -m "fix: address issues found during Phase-3 manual verification"
```

---

## Task 10: Package an ad-hoc-signed macOS build

Personal distribution — ad-hoc/self-signed is enough (spec §2 non-goal: no App Store/notarization).

**Files:**

- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Configure the bundle**

In `src-tauri/tauri.conf.json`, set the `bundle` block:

```json
"bundle": {
  "active": true,
  "targets": ["app", "dmg"],
  "category": "DeveloperTool",
  "macOS": {
    "minimumSystemVersion": "10.15"
  }
}
```

- [ ] **Step 2: Build the app**

Run: `npm run tauri build`
Expected: a release build under `src-tauri/target/release/bundle/` — a `macos/ToolKit.app` and a `dmg/ToolKit_*.dmg`. The first release build is slow (optimized Rust compile).

- [ ] **Step 3: Ad-hoc sign (so Gatekeeper allows local launch)**

Run:

```bash
codesign --force --deep --sign - "src-tauri/target/release/bundle/macos/ToolKit.app"
codesign --verify --deep --strict "src-tauri/target/release/bundle/macos/ToolKit.app" && echo "ad-hoc signature OK"
```

Expected: `ad-hoc signature OK`. (`--sign -` is the ad-hoc identity. For a personal Developer ID later, substitute the identity name.)

- [ ] **Step 4: Smoke-launch the packaged app**

Open `src-tauri/target/release/bundle/macos/ToolKit.app`. On first launch macOS may warn (unidentified developer) — right-click → Open to allow. Confirm: window opens, all 10 tools work, the global hotkey toggles, tray Quit exits.

> If macOS blocks it, `xattr -dr com.apple.quarantine "…/ToolKit.app"` removes the quarantine flag for a locally built app.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: configure macOS bundle for ad-hoc personal packaging"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-06-toolkit-design.md` §10, §11 Phase 3, §5 hotkey, §12):

| Spec item                                                    | Covered by                            |
| ------------------------------------------------------------ | ------------------------------------- |
| Never block UI thread; heavy transforms in a Web Worker      | Tasks 1–4                             |
| Route to Rust fast-path above ~1 MB (serde_json / quick-xml) | Tasks 3, 5                            |
| Thresholds tunable (workerAt / rustAt)                       | Task 3 (`DEFAULT_THRESHOLDS`)         |
| Inline progress for ops > 300 ms                             | Task 4 (`pending` "Working…")         |
| Settings screen                                              | Task 8                                |
| Global hotkey configurable + persisted                       | Tasks 6, 7, 8                         |
| Packaging/signing (personal ad-hoc / self-signed)            | Task 10                               |
| Pure transforms reused unchanged; never throw                | Task 1 (wraps Plan 1/3 functions)     |
| Unit tests on new pure logic; manual verify for native/shell | Tasks 1, 3, 6 (unit) + 9, 10 (manual) |

**No new tools** are added (Phase 3 is polish only), matching §11.

**2. Placeholder scan:** No "TBD"/"similar to Task N"/vague handling. Worker/Rust wiring that can't run in jsdom is explicitly moved to manual verification (Task 9), not faked. The two residual native risks (quick-xml `config_mut` API drift) carry concrete remediation notes and a guaranteed router fallback, so they never break the tool.

**3. Type consistency:** `ToolResult`/`TransformOpts` flow unchanged from `transforms.ts` (Task 1) through `route.ts` (Task 3), `rust.ts`/`useTransform.ts` (Task 4). Op names (`"json.format"`, `"json.minify"`, `"json.sortKeys"`, `"xml.format"`, `"xml.minify"`) are identical across `TRANSFORMS` (Task 1), `RUST_OPS`/`RUST_CMD` (Tasks 3, 4), the Rust command names (`json_format`/`json_minify`/`xml_format`/`xml_minify`, Task 5), and the tool action lists (Task 4). `runTransform(op, input, opts, deps)` signature matches its `useTransform` caller. `set_hotkey({ accelerator })` (Rust, Task 7) matches the `invoke("set_hotkey", { accelerator })` calls (Tasks 8). `hotkey`/`setHotkey`/`DEFAULT_HOTKEY` (store, Task 6) match Settings (Task 8) and App boot/persist (Task 8). `chooseRoute` thresholds use the same `{ workerAt, rustAt }` shape in tests and source.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-toolkit-phase-3-polish.md`. Depends on Plans 1–3. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session with checkpoints.

**Note:** Tasks 5, 7, 9, 10 are native/interactive and must run on macOS with the Rust toolchain. The worker and Rust fast-path wiring is verified manually (Task 9) since module workers and Tauri `invoke` don't run under jsdom; all new pure logic (registry, router, store slice) is unit-tested.
