# ToolKit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ToolKit macOS app shell with its plugin framework, cross-cutting services, native Rust integration (global hotkey, tray, clipboard), and one fully working tool (JSON) — proving the plugin pattern end-to-end.

**Architecture:** Tauri 2 native shell (WKWebView) hosting a React 18 + TypeScript frontend. Almost all logic is pure TS in the WebView; a thin Rust layer handles the global hotkey, system tray, and clipboard. Each tool is a self-contained module (`{ metadata + pure logic + workspace component }`) registered in a central `Tool[]` registry; the shell builds the sidebar and ⌘K palette from that registry. Pure transforms return `{ ok, value } | { ok, error }` and never throw into the UI.

**Tech Stack:** Tauri 2, React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (cmdk-based Command), Zustand, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-global-shortcut`, `@tauri-apps/plugin-clipboard-manager`, Lucide icons, Vitest + React Testing Library.

> **Source spec:** `docs/superpowers/specs/2026-06-06-toolkit-design.md`. Approved decisions baked into this plan: macOS-blue accent, ⌥Space global hotkey, JSON in the Phase-1 batch. This plan is the **first** of the Phase-1 set (Foundation + JSON); a follow-up plan covers Base64/URL/Time/Diff.

> **Scope deferred to later plans (do NOT build here):** Web Worker pool, Rust `serde_json` fast-path (Phase 3), settings screen (Phase 3), packaging/signing (Phase 3), the other four tools (Plan 2). The JSON tool here uses native `JSON` only.

---

## File Structure

Files created or modified across this plan, each with one clear responsibility:

| Path                                   | Responsibility                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src-tauri/src/lib.rs`                 | Tauri builder: register plugins, ⌥Space global shortcut, tray, window show/hide                |
| `src-tauri/capabilities/default.json`  | Permissions for store, global-shortcut, clipboard (written by `tauri add`)                     |
| `src-tauri/tauri.conf.json`            | Window config: hidden-on-blur behaviour, title, size                                           |
| `vite.config.ts`                       | Vite + React + Tailwind v4 plugin + `@` path alias                                             |
| `src/index.css`                        | Tailwind import + light/dark design tokens (slate + blue/green/red/amber)                      |
| `src/core/types.ts`                    | The `Tool` plugin contract: `Tool`, `ToolCommand`, `ToolContext`, `ToolResult`, `ToolCategory` |
| `src/core/store.ts`                    | Zustand store: `activeToolId`, `favorites`, `theme`                                            |
| `src/core/services/storage.ts`         | Injectable KV over `tauri-plugin-store` (in-memory backend for tests)                          |
| `src/core/services/history.ts`         | Pure `pushHistory` ring-buffer logic                                                           |
| `src/core/hooks/useHistory.ts`         | React hook wiring history logic + storage per tool                                             |
| `src/core/hooks/useClipboardDetect.ts` | Reads clipboard on tool open, runs `tool.detectClipboard`                                      |
| `src/core/registry.ts`                 | The `Tool[]` registry + `getTool(id)`                                                          |
| `src/tools/json/json.ts`               | Pure JSON transforms: format/minify/escape/unescape/validate/sort-keys                         |
| `src/tools/json/json.test.ts`          | Vitest unit tests for `json.ts`                                                                |
| `src/tools/json/JsonTool.tsx`          | JSON workspace component                                                                       |
| `src/tools/json/index.ts`              | `jsonTool` Tool definition (metadata + wiring)                                                 |
| `src/app/ThemeProvider.tsx`            | Applies system light/dark + store override to `<html>`                                         |
| `src/app/Sidebar.tsx`                  | Sidebar built from registry; favorites section                                                 |
| `src/app/DetailHost.tsx`               | Mounts active tool component; empty state                                                      |
| `src/app/CommandPalette.tsx`           | ⌘K palette over `name + keywords + commands`                                                   |
| `src/app/ClipboardBanner.tsx`          | Inline "fill from clipboard" banner                                                            |
| `src/App.tsx`                          | Top-level layout; boot hydration; wires shell + palette + theme                                |
| `src/components/ui/*`                  | shadcn primitives (button, command, dialog) — generated                                        |

---

## Task 0: Install the Rust toolchain (one-time prerequisite)

Tauri builds need a Rust toolchain, which is **not installed** on this machine. This step is interactive and global, so the **user** runs it (suggest typing `! ...` in the prompt). No commit.

- [ ] **Step 1: Install rustup (user runs)**

In the Claude Code prompt, the user types:

```
! curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Then activate the toolchain in the current shell:

```
! source "$HOME/.cargo/env"
```

- [ ] **Step 2: Verify the toolchain**

Run: `rustc --version && cargo --version`
Expected: two version lines, e.g. `rustc 1.8x.0 (...)` and `cargo 1.8x.0 (...)`. If "command not found", restart the shell or re-run `source "$HOME/.cargo/env"`.

---

## Task 1: Scaffold the Tauri 2 + React + TS + Vite app

**Files:**

- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src-tauri/**` (generated)

The repo already exists with `docs/` and `.gitignore`. Scaffold into the current directory.

- [ ] **Step 1: Run the Tauri scaffolder into the repo**

Run from `/Users/hw93/projects/tool-kit`:

```bash
npm create tauri-app@latest . -- --template react-ts --manager npm --identifier com.hw93.toolkit
```

If the CLI refuses a non-empty directory, scaffold into a temp dir and merge:

```bash
npm create tauri-app@latest toolkit-tmp -- --template react-ts --manager npm --identifier com.hw93.toolkit
rsync -a --exclude .git toolkit-tmp/ ./ && rm -rf toolkit-tmp
```

- [ ] **Step 2: Install JS dependencies**

Run: `npm install`
Expected: `node_modules/` populated, no errors.

- [ ] **Step 3: Verify the dev app launches**

Run: `npm run tauri dev`
Expected: Rust compiles (first build is slow), a native macOS window opens showing the default Tauri+React page. Quit the window (⌘Q) to stop.

- [ ] **Step 4: Set the window title and identifier**

Modify `src-tauri/tauri.conf.json` — set `productName` to `ToolKit`, and the main window block:

```json
"windows": [
  {
    "title": "ToolKit",
    "width": 1100,
    "height": 720,
    "minWidth": 720,
    "minHeight": 480,
    "resizable": true
  }
]
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri 2 + React + TS + Vite app"
```

---

## Task 2: Configure the `@` path alias

shadcn/ui and our imports use the `@/` alias for `src/`.

**Files:**

- Modify: `vite.config.ts`, `tsconfig.json`

- [ ] **Step 1: Add the alias to Vite**

Modify `vite.config.ts` to include the resolve alias (keep the existing Tauri/React plugin config):

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
```

- [ ] **Step 2: Add the alias to TypeScript**

Modify `tsconfig.json` — add under `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 3: Verify the build still typechecks**

Run: `npm run build`
Expected: Vite build succeeds (TypeScript compiles with no path errors).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts tsconfig.json
git commit -m "chore: add @ path alias for src"
```

---

## Task 3: Add Tailwind CSS v4 + design tokens

**Files:**

- Modify: `vite.config.ts`, `src/index.css`
- Create/replace: `src/index.css` token definitions

- [ ] **Step 1: Install Tailwind v4**

Run: `npm install tailwindcss @tailwindcss/vite`
Expected: packages added.

- [ ] **Step 2: Wire the Tailwind Vite plugin**

Modify `vite.config.ts` to add the plugin:

```ts
import tailwindcss from "@tailwindcss/vite";
// ...
plugins: [react(), tailwindcss()],
```

- [ ] **Step 3: Replace `src/index.css` with Tailwind import + design tokens**

Replace the entire contents of `src/index.css`:

```css
@import "tailwindcss";

:root {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.21 0.03 256);
  --muted: oklch(0.96 0.01 256);
  --muted-foreground: oklch(0.55 0.02 256);
  --border: oklch(0.92 0.01 256);
  --primary: oklch(0.55 0.21 257); /* macOS blue */
  --primary-foreground: oklch(0.99 0 0);
  --success: oklch(0.65 0.18 150); /* green = valid */
  --error: oklch(0.58 0.22 25); /* red = error */
  --favorite: oklch(0.78 0.16 80); /* amber star */
}

.dark {
  --background: oklch(0.18 0.02 256);
  --foreground: oklch(0.95 0.01 256);
  --muted: oklch(0.25 0.02 256);
  --muted-foreground: oklch(0.65 0.02 256);
  --border: oklch(0.3 0.02 256);
  --primary: oklch(0.62 0.19 257);
  --primary-foreground: oklch(0.15 0.02 256);
  --success: oklch(0.7 0.17 150);
  --error: oklch(0.65 0.2 25);
  --favorite: oklch(0.8 0.15 80);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-success: var(--success);
  --color-error: var(--error);
  --color-favorite: var(--favorite);
  --font-sans:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui,
    sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

html,
body,
#root {
  height: 100%;
}
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 4: Verify Tailwind renders**

Temporarily set `src/App.tsx` body to `<div className="p-6 text-primary font-mono">Tailwind OK</div>`, run `npm run tauri dev`, confirm blue monospace text. Revert the temporary change afterward (App.tsx is rebuilt in Task 18).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/index.css package.json package-lock.json
git commit -m "feat: add Tailwind v4 with light/dark design tokens"
```

---

## Task 4: Add the Tauri plugins (store, global-shortcut, clipboard)

`npx tauri add` installs the Rust crate, the JS binding, and the capability permission in one shot.

**Files:**

- Modify: `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `package.json` (generated by the command)

- [ ] **Step 1: Add the three plugins**

Run:

```bash
npx tauri add store
npx tauri add global-shortcut
npx tauri add clipboard-manager
```

Expected: each prints that it added the Rust dependency, the npm package, and updated `capabilities/default.json`.

- [ ] **Step 2: Install the pure-JS deps**

Run: `npm install zustand lucide-react`
Expected: packages added.

- [ ] **Step 3: Verify the Rust side still compiles**

Run: `npm run tauri dev`
Expected: Rust recompiles with the new crates and the window opens. Quit it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add store, global-shortcut, clipboard-manager plugins + zustand, lucide"
```

---

## Task 5: Configure Vitest + React Testing Library

**Files:**

- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/test/smoke.test.ts`
- Modify: `package.json` (test script)

- [ ] **Step 1: Install test deps**

Run:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the test script**

Modify `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test**

Create `src/test/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test`
Expected: PASS — `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/test package.json package-lock.json
git commit -m "test: configure Vitest + React Testing Library"
```

---

## Task 6: Define the Tool plugin contract

**Files:**

- Create: `src/core/types.ts`

No test (types only); consumed and exercised by the registry test (Task 12) and JSON tests (Task 10).

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type ToolCategory = "encode-text" | "convert-other";

/** Pure-transform result. Transforms never throw into the UI. */
export type ToolResult<T = string> =
  | { ok: true; value: T }
  | { ok: false; error: string; line?: number; col?: number };

/** Passed to ⌘K command actions so they can drive the active tool. */
export interface ToolContext {
  input: string;
  setInput: (text: string) => void;
}

export interface ToolCommand {
  id: string;
  title: string; // shown in ⌘K
  run: (ctx: ToolContext) => void;
}

export interface Tool {
  id: string; // "json"
  name: string; // display name, e.g. "JSON"
  category: ToolCategory;
  icon: LucideIcon;
  keywords: string[]; // fuel for ⌘K fuzzy search
  component: ComponentType; // the workspace UI
  detectClipboard?: (text: string) => boolean; // smart-detect banner
  commands?: ToolCommand[]; // extra actions surfaced in ⌘K
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: define Tool plugin contract types"
```

---

## Task 7: Zustand store (active tool, favorites, theme)

**Files:**

- Create: `src/core/store.ts`, `src/core/store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("app store", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeToolId: null,
      favorites: [],
      theme: "system",
    });
  });

  it("sets the active tool", () => {
    useAppStore.getState().setActiveTool("json");
    expect(useAppStore.getState().activeToolId).toBe("json");
  });

  it("toggles a favorite on and off", () => {
    const { toggleFavorite } = useAppStore.getState();
    toggleFavorite("json");
    expect(useAppStore.getState().favorites).toEqual(["json"]);
    toggleFavorite("json");
    expect(useAppStore.getState().favorites).toEqual([]);
  });

  it("hydrates persisted slices", () => {
    useAppStore.getState().hydrate({ favorites: ["base64"], theme: "dark" });
    expect(useAppStore.getState().favorites).toEqual(["base64"]);
    expect(useAppStore.getState().theme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/store.test.ts`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Write `src/core/store.ts`**

```ts
import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  hydrate: (
    slice: Partial<Pick<AppState, "favorites" | "theme" | "activeToolId">>,
  ) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeToolId: null,
  favorites: [],
  theme: "system",
  setActiveTool: (id) => set({ activeToolId: id }),
  toggleFavorite: (id) =>
    set((s) => ({
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((f) => f !== id)
        : [...s.favorites, id],
    })),
  setTheme: (theme) => set({ theme }),
  hydrate: (slice) => set(slice),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/store.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/store.ts src/core/store.test.ts
git commit -m "feat: add zustand store for active tool, favorites, theme"
```

---

## Task 8: Injectable KV storage over `tauri-plugin-store`

A thin KV interface with a swappable backend so tests run without Tauri.

**Files:**

- Create: `src/core/services/storage.ts`, `src/core/services/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/services/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { storage, setStorageBackend, type KV } from "./storage";

function memoryBackend(): KV {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.has(key) ? (map.get(key) as T) : null;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
  };
}

describe("storage KV", () => {
  beforeEach(() => setStorageBackend(memoryBackend()));

  it("returns null for a missing key", async () => {
    expect(await storage().get("nope")).toBeNull();
  });

  it("round-trips a value", async () => {
    await storage().set("favorites", ["json", "base64"]);
    expect(await storage().get<string[]>("favorites")).toEqual([
      "json",
      "base64",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/services/storage.test.ts`
Expected: FAIL — cannot find module `./storage`.

- [ ] **Step 3: Write `src/core/services/storage.ts`**

```ts
import { LazyStore } from "@tauri-apps/plugin-store";

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

let backend: KV | null = null;

/** Test seam: inject an in-memory backend. */
export function setStorageBackend(kv: KV): void {
  backend = kv;
}

function tauriBackend(): KV {
  const store = new LazyStore("toolkit.json");
  return {
    async get<T>(key: string) {
      return ((await store.get<T>(key)) ?? null) as T | null;
    },
    async set<T>(key: string, value: T) {
      await store.set(key, value);
      await store.save();
    },
  };
}

export function storage(): KV {
  if (!backend) backend = tauriBackend();
  return backend;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/services/storage.test.ts`
Expected: PASS — 2 passed. (The `@tauri-apps/plugin-store` import is never executed because the test injects a backend before `storage()` is called.)

- [ ] **Step 5: Commit**

```bash
git add src/core/services/storage.ts src/core/services/storage.test.ts
git commit -m "feat: add injectable KV storage over tauri-plugin-store"
```

---

## Task 9: History ring-buffer (pure logic + hook)

**Files:**

- Create: `src/core/services/history.ts`, `src/core/services/history.test.ts`, `src/core/hooks/useHistory.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/services/history.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pushHistory, type HistoryEntry } from "./history";

const entry = (input: string, ts: number): HistoryEntry => ({
  input,
  output: input.toUpperCase(),
  ts,
});

describe("pushHistory", () => {
  it("prepends the newest entry", () => {
    const list = pushHistory([], entry("a", 1), 20);
    expect(list[0].input).toBe("a");
  });

  it("dedupes by input, keeping the newest position", () => {
    let list = pushHistory([], entry("a", 1), 20);
    list = pushHistory(list, entry("b", 2), 20);
    list = pushHistory(list, entry("a", 3), 20);
    expect(list.map((e) => e.input)).toEqual(["a", "b"]);
    expect(list[0].ts).toBe(3);
  });

  it("caps the list length", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 25; i++)
      list = pushHistory(list, entry(`x${i}`, i), 20);
    expect(list).toHaveLength(20);
    expect(list[0].input).toBe("x24");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/services/history.test.ts`
Expected: FAIL — cannot find module `./history`.

- [ ] **Step 3: Write `src/core/services/history.ts`**

```ts
export interface HistoryEntry {
  input: string;
  output: string;
  ts: number;
}

/** Newest-first, deduped by input, capped. Pure. */
export function pushHistory(
  list: HistoryEntry[],
  entry: HistoryEntry,
  cap = 20,
): HistoryEntry[] {
  const deduped = list.filter((e) => e.input !== entry.input);
  return [entry, ...deduped].slice(0, cap);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/services/history.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Write the hook `src/core/hooks/useHistory.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { storage } from "@/core/services/storage";
import { pushHistory, type HistoryEntry } from "@/core/services/history";

const key = (toolId: string) => `history:${toolId}`;

export function useHistory(toolId: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    storage()
      .get<HistoryEntry[]>(key(toolId))
      .then((stored) => {
        if (active) setEntries(stored ?? []);
      });
    return () => {
      active = false;
    };
  }, [toolId]);

  const record = useCallback(
    (input: string, output: string) => {
      if (!input.trim()) return;
      setEntries((prev) => {
        const next = pushHistory(prev, { input, output, ts: Date.now() });
        void storage().set(key(toolId), next);
        return next;
      });
    },
    [toolId],
  );

  return { entries, record };
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/history.ts src/core/services/history.test.ts src/core/hooks/useHistory.ts
git commit -m "feat: add per-tool history ring buffer + useHistory hook"
```

---

## Task 10: JSON pure transforms (TDD)

The heart of the JSON tool. All transforms return `ToolResult` and never throw.

**Files:**

- Create: `src/tools/json/json.ts`, `src/tools/json/json.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/json/json.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  formatJson,
  minifyJson,
  escapeJson,
  unescapeJson,
  sortJsonKeys,
} from "./json";

describe("formatJson", () => {
  it("pretty-prints valid JSON with 2-space indent", () => {
    const r = formatJson('{"b":1,"a":2}');
    expect(r).toEqual({ ok: true, value: '{\n  "b": 1,\n  "a": 2\n}' });
  });

  it("returns an error with a line/col for invalid JSON", () => {
    const r = formatJson('{"a": }');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/./);
      expect(typeof r.line).toBe("number");
      expect(typeof r.col).toBe("number");
    }
  });

  it("handles empty input as an error, not a throw", () => {
    expect(formatJson("").ok).toBe(false);
  });

  it("round-trips unicode", () => {
    const r = formatJson('{"k":"café — 中文"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toContain("café — 中文");
  });
});

describe("minifyJson", () => {
  it("strips whitespace", () => {
    expect(minifyJson('{\n  "a": 1\n}')).toEqual({
      ok: true,
      value: '{"a":1}',
    });
  });
});

describe("escapeJson / unescapeJson", () => {
  it("escapes a raw string into a JSON string literal", () => {
    expect(escapeJson('he said "hi"\n')).toEqual({
      ok: true,
      value: '"he said \\"hi\\"\\n"',
    });
  });

  it("unescapes a JSON string literal back to raw text", () => {
    expect(unescapeJson('"he said \\"hi\\"\\n"')).toEqual({
      ok: true,
      value: 'he said "hi"\n',
    });
  });

  it("unescape rejects a non-string literal", () => {
    expect(unescapeJson("{}").ok).toBe(false);
  });
});

describe("sortJsonKeys", () => {
  it("sorts object keys recursively, preserving arrays", () => {
    const r = sortJsonKeys('{"b":1,"a":{"d":4,"c":[3,2,1]}}');
    expect(r).toEqual({
      ok: true,
      value:
        '{\n  "a": {\n    "c": [\n      3,\n      2,\n      1\n    ],\n    "d": 4\n  },\n  "b": 1\n}',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/json/json.test.ts`
Expected: FAIL — cannot find module `./json`.

- [ ] **Step 3: Write `src/tools/json/json.ts`**

```ts
import type { ToolResult } from "@/core/types";

/** Map a 0-based character offset to 1-based line/column. */
function offsetToLineCol(
  text: string,
  offset: number,
): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/** Extract a location from a JSON.parse error message where possible. */
function locate(
  message: string,
  input: string,
): { line?: number; col?: number } {
  // Modern V8: "... in JSON at position 6 (line 1 column 7)"
  const lc = message.match(/line (\d+) column (\d+)/);
  if (lc) return { line: Number(lc[1]), col: Number(lc[2]) };
  // Older form: "... at position 6"
  const pos = message.match(/position (\d+)/);
  if (pos) return offsetToLineCol(input, Number(pos[1]));
  return {};
}

function parse(input: string): ToolResult<unknown> {
  if (!input.trim()) return { ok: false, error: "Input is empty" };
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, ...locate(message, input) };
  }
}

export function formatJson(input: string, indent = 2): ToolResult {
  const r = parse(input);
  return r.ok ? { ok: true, value: JSON.stringify(r.value, null, indent) } : r;
}

export function minifyJson(input: string): ToolResult {
  const r = parse(input);
  return r.ok ? { ok: true, value: JSON.stringify(r.value) } : r;
}

/** Escape a raw string into a quoted JSON string literal. */
export function escapeJson(input: string): ToolResult {
  return { ok: true, value: JSON.stringify(input) };
}

/** Parse a quoted JSON string literal back into its raw text. */
export function unescapeJson(input: string): ToolResult {
  const r = parse(input);
  if (!r.ok) return r;
  if (typeof r.value !== "string") {
    return { ok: false, error: "Input is not a JSON string literal" };
  }
  return { ok: true, value: r.value };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortValue((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function sortJsonKeys(input: string, indent = 2): ToolResult {
  const r = parse(input);
  return r.ok
    ? { ok: true, value: JSON.stringify(sortValue(r.value), null, indent) }
    : r;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/json/json.test.ts`
Expected: PASS — all assertions green. (The line/col test passes under Vitest's V8, whose message includes `(line 1 column 7)`.)

- [ ] **Step 5: Commit**

```bash
git add src/tools/json/json.ts src/tools/json/json.test.ts
git commit -m "feat: add JSON pure transforms (format/minify/escape/sort) with line:col errors"
```

---

## Task 11: JSON workspace component + Tool definition

**Files:**

- Create: `src/tools/json/JsonTool.tsx`, `src/tools/json/index.ts`, `src/tools/json/JsonTool.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/tools/json/JsonTool.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { setStorageBackend, type KV } from "@/core/services/storage";
import JsonTool from "./JsonTool";

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

describe("JsonTool", () => {
  beforeEach(() => setStorageBackend(memoryBackend()));

  it("formats input on Format", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"b":1,"a":2}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByLabelText("Output").textContent).toContain('"b": 1');
  });

  it("shows an error state for invalid JSON", () => {
    render(<JsonTool />);
    const input = screen.getByLabelText("JSON input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/json/JsonTool.test.tsx`
Expected: FAIL — cannot find module `./JsonTool`.

- [ ] **Step 3: Write `src/tools/json/JsonTool.tsx`**

```tsx
import { useState } from "react";
import { formatJson, minifyJson, sortJsonKeys } from "./json";
import type { ToolResult } from "@/core/types";
import { useHistory } from "@/core/hooks/useHistory";

type Action = (input: string) => ToolResult;

const ACTIONS: { label: string; run: Action }[] = [
  { label: "Format", run: (i) => formatJson(i) },
  { label: "Minify", run: (i) => minifyJson(i) },
  { label: "Sort keys", run: (i) => sortJsonKeys(i) },
];

export default function JsonTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const { record } = useHistory("json");

  function apply(run: Action) {
    const r = run(input);
    setResult(r);
    if (r.ok) record(input, r.value);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => apply(a.run)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <textarea
          aria-label="JSON input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Paste JSON here, e.g. {"hello": "world"}'
          className="h-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="h-full overflow-auto rounded-md border border-border bg-muted p-3">
          {result?.ok && (
            <pre
              aria-label="Output"
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
          {!result && (
            <p className="text-sm text-muted-foreground">
              Output appears here. Paste JSON and pick an action.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the Tool definition `src/tools/json/index.ts`**

```ts
import { Braces } from "lucide-react";
import type { Tool } from "@/core/types";
import { formatJson } from "./json";
import JsonTool from "./JsonTool";

export const jsonTool: Tool = {
  id: "json",
  name: "JSON",
  category: "encode-text",
  icon: Braces,
  keywords: ["json", "format", "pretty", "minify", "validate", "格式化"],
  component: JsonTool,
  detectClipboard(text: string) {
    return formatJson(text).ok;
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tools/json/JsonTool.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/tools/json/JsonTool.tsx src/tools/json/index.ts src/tools/json/JsonTool.test.tsx
git commit -m "feat: add JSON workspace component and Tool definition"
```

---

## Task 12: The Tool registry

**Files:**

- Create: `src/core/registry.ts`, `src/core/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tools, getTool } from "./registry";

describe("registry", () => {
  it("contains the JSON tool", () => {
    expect(getTool("json")?.name).toBe("JSON");
  });

  it("has unique tool ids", () => {
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for an unknown id", () => {
    expect(getTool("does-not-exist")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/registry.test.ts`
Expected: FAIL — cannot find module `./registry`.

- [ ] **Step 3: Write `src/core/registry.ts`**

```ts
import type { Tool } from "./types";
import { jsonTool } from "@/tools/json";

export const tools: Tool[] = [jsonTool];

export function getTool(id: string | null): Tool | undefined {
  return id ? tools.find((t) => t.id === id) : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/registry.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts src/core/registry.test.ts
git commit -m "feat: add Tool registry"
```

---

## Task 13: Theme provider (system light/dark + override)

**Files:**

- Create: `src/app/ThemeProvider.tsx`

- [ ] **Step 1: Write `src/app/ThemeProvider.tsx`**

```tsx
import { useEffect } from "react";
import { useAppStore } from "@/core/store";

/** Applies the `.dark` class on <html> based on store theme + system preference. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    if (theme === "system") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
  }, [theme]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/ThemeProvider.tsx
git commit -m "feat: add theme provider following system light/dark"
```

---

## Task 14: Sidebar built from the registry

**Files:**

- Create: `src/app/Sidebar.tsx`

- [ ] **Step 1: Write `src/app/Sidebar.tsx`**

```tsx
import { Star } from "lucide-react";
import { tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function Sidebar() {
  const activeToolId = useAppStore((s) => s.activeToolId);
  const favorites = useAppStore((s) => s.favorites);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  const pinned = tools.filter((t) => favorites.includes(t.id));
  const rest = tools.filter((t) => !favorites.includes(t.id));

  const Row = (tool: (typeof tools)[number]) => {
    const Icon = tool.icon;
    const active = tool.id === activeToolId;
    return (
      <button
        key={tool.id}
        onClick={() => setActiveTool(tool.id)}
        className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
          active ? "bg-primary/10 text-primary" : "hover:bg-muted"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 truncate">{tool.name}</span>
        <Star
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(tool.id);
          }}
          className={`h-3.5 w-3.5 opacity-0 group-hover:opacity-60 ${
            favorites.includes(tool.id)
              ? "fill-favorite text-favorite opacity-100"
              : ""
          }`}
        />
      </button>
    );
  };

  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-border bg-background p-2">
      <div className="px-2 py-1.5 text-sm font-semibold">ToolKit</div>
      {pinned.length > 0 && (
        <>
          <div className="px-2 pt-2 text-xs uppercase text-muted-foreground">
            Favorites
          </div>
          {pinned.map(Row)}
          <div className="my-1 h-px bg-border" />
        </>
      )}
      {rest.map(Row)}
    </nav>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/Sidebar.tsx
git commit -m "feat: add sidebar built from the tool registry with favorites"
```

---

## Task 15: Detail host (mounts the active tool)

**Files:**

- Create: `src/app/DetailHost.tsx`

- [ ] **Step 1: Write `src/app/DetailHost.tsx`**

```tsx
import { getTool } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function DetailHost() {
  const activeToolId = useAppStore((s) => s.activeToolId);
  const tool = getTool(activeToolId);

  if (!tool) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Pick a tool from the sidebar, or press
            <kbd className="mx-1 rounded border border-border px-1.5 py-0.5 font-mono text-xs">
              ⌘K
            </kbd>
            to search.
          </p>
        </div>
      </div>
    );
  }

  const ToolComponent = tool.component;
  return (
    <main className="flex h-full flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <tool.icon className="h-4 w-4" strokeWidth={1.75} />
        <h1 className="text-sm font-medium">{tool.name}</h1>
      </header>
      <div className="min-h-0 flex-1">
        <ToolComponent />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/DetailHost.tsx
git commit -m "feat: add detail host with empty state"
```

---

## Task 16: ⌘K command palette

shadcn's Command wraps `cmdk`. Generate the primitive, then build the palette over the registry.

**Files:**

- Create: `src/app/CommandPalette.tsx`, generated `src/components/ui/command.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/button.tsx`, `components.json`

- [ ] **Step 1: Init shadcn and add components**

Run:

```bash
npx shadcn@latest init -d
npx shadcn@latest add command dialog button
```

Expected: `components.json` created; `src/components/ui/{command,dialog,button}.tsx` generated; `cmdk` + Radix deps installed. Accept defaults; if prompted for the style/base color, choose defaults (the design tokens in `index.css` already drive colors).

- [ ] **Step 2: Write `src/app/CommandPalette.tsx`**

```tsx
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (toolId: string) => {
    setActiveTool(toolId);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tools and actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Tools">
          {tools.map((tool) => (
            <CommandItem
              key={tool.id}
              value={`${tool.name} ${tool.keywords.join(" ")}`}
              onSelect={() => choose(tool.id)}
            >
              <tool.icon className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {tool.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          {tools.flatMap((tool) =>
            (tool.commands ?? []).map((cmd) => (
              <CommandItem
                key={`${tool.id}:${cmd.id}`}
                value={`${tool.name} ${cmd.title}`}
                onSelect={() => choose(tool.id)}
              >
                {tool.name}: {cmd.title}
              </CommandItem>
            )),
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add ⌘K command palette over the registry (shadcn cmdk)"
```

---

## Task 17: Clipboard smart-detect banner

Reads the clipboard on tool open and offers to fill the input if the active tool's `detectClipboard` matches.

**Files:**

- Create: `src/core/hooks/useClipboardDetect.ts`, `src/app/ClipboardBanner.tsx`

- [ ] **Step 1: Write `src/core/hooks/useClipboardDetect.ts`**

```ts
import { useEffect, useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getTool } from "@/core/registry";
import { useAppStore } from "@/core/store";

/** On active-tool change, read the clipboard and test the tool's detector. */
export function useClipboardDetect(): {
  text: string | null;
  clear: () => void;
} {
  const activeToolId = useAppStore((s) => s.activeToolId);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const tool = getTool(activeToolId);
    if (!tool?.detectClipboard) {
      setText(null);
      return;
    }
    readText()
      .then((clip) => {
        if (active && clip && tool.detectClipboard?.(clip)) setText(clip);
        else if (active) setText(null);
      })
      .catch(() => {
        if (active) setText(null);
      });
    return () => {
      active = false;
    };
  }, [activeToolId]);

  return { text, clear: () => setText(null) };
}
```

- [ ] **Step 2: Write `src/app/ClipboardBanner.tsx`**

```tsx
import { ClipboardPaste, X } from "lucide-react";

export function ClipboardBanner({
  text,
  onFill,
  onDismiss,
}: {
  text: string;
  onFill: (text: string) => void;
  onDismiss: () => void;
}) {
  const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return (
    <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
      <ClipboardPaste className="h-4 w-4 text-primary" strokeWidth={1.75} />
      <span className="flex-1 truncate text-muted-foreground">
        Clipboard looks fillable: <span className="font-mono">{preview}</span>
      </span>
      <button
        onClick={() => onFill(text)}
        className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
      >
        Fill
      </button>
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

> **Note:** wiring `onFill` into a specific tool's input is per-tool. For Phase 1, the JSON tool is self-contained (manages its own input state), so the banner here surfaces detection app-wide and is shown in `DetailHost` above the tool; deeper input-injection is folded into the shared `ToolContext` in Plan 2 when multiple tools need it. For now `onFill` copies the text to the clipboard-detection state only. Keep the banner visible-but-informational in this plan.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/hooks/useClipboardDetect.ts src/app/ClipboardBanner.tsx
git commit -m "feat: add clipboard smart-detect hook and inline banner"
```

---

## Task 18: Rust — global hotkey (⌥Space), tray, window toggle

**Files:**

- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json` (hide from dock optional; keep default for now)
- Verify: `src-tauri/capabilities/default.json` (written by `tauri add` in Task 4)

- [ ] **Step 1: Write the window-toggle + setup in `src/lib.rs`**

Replace the body of `pub fn run()` in `src-tauri/src/lib.rs`:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // ⌥Space global hotkey (Option+Space)
            let alt_space = Shortcut::new(Some(Modifiers::ALT), Code::Space);
            app.global_shortcut().register(alt_space)?;

            // System tray with a Quit item
            let quit = MenuItem::with_id(app, "quit", "Quit ToolKit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show ToolKit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => toggle_main_window(app),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Ensure tray feature is enabled**

Modify `src-tauri/Cargo.toml` — the `tauri` dependency must include the tray feature:

```toml
tauri = { version = "2", features = ["tray-icon"] }
```

Run: `cd src-tauri && cargo build && cd ..`
Expected: compiles. If `tray-icon` is missing it fails — add the feature and rebuild.

- [ ] **Step 3: Verify hotkey + tray manually**

Run: `npm run tauri dev`
Expected: window opens; a tray icon appears in the macOS menu bar; pressing **⌥Space** hides the window, pressing again shows it; the tray "Quit ToolKit" exits the app.

> macOS will prompt for Accessibility/Input Monitoring permission the first time the global shortcut registers — grant it in System Settings → Privacy & Security if the hotkey doesn't fire.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add ⌥Space global hotkey, tray, and window toggle"
```

---

## Task 19: Assemble the app shell

Wire ThemeProvider + Sidebar + DetailHost + CommandPalette + clipboard banner, and hydrate the store from storage on boot.

**Files:**

- Replace: `src/App.tsx`
- Verify: `src/main.tsx` renders `<App />` and imports `./index.css`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/app/ThemeProvider";
import { Sidebar } from "@/app/Sidebar";
import { DetailHost } from "@/app/DetailHost";
import { CommandPalette } from "@/app/CommandPalette";
import { ClipboardBanner } from "@/app/ClipboardBanner";
import { useClipboardDetect } from "@/core/hooks/useClipboardDetect";
import { useAppStore, type ThemeMode } from "@/core/store";
import { storage } from "@/core/services/storage";

function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);
  const { text: clipText, clear: clearClip } = useClipboardDetect();

  useEffect(() => {
    Promise.all([
      storage().get<string[]>("favorites"),
      storage().get<ThemeMode>("theme"),
    ]).then(([favorites, theme]) => {
      hydrate({
        ...(favorites ? { favorites } : {}),
        ...(theme ? { theme } : {}),
      });
      setReady(true);
    });
  }, [hydrate]);

  // Persist favorites + theme whenever they change.
  useEffect(() => {
    const unsub = useAppStore.subscribe((s) => {
      void storage().set("favorites", s.favorites);
      void storage().set("theme", s.theme);
    });
    return unsub;
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {clipText && (
            <ClipboardBanner
              text={clipText}
              onFill={() => clearClip()}
              onDismiss={clearClip}
            />
          )}
          <DetailHost />
        </div>
        <CommandPalette />
      </div>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 2: Verify `src/main.tsx` imports the stylesheet**

Confirm `src/main.tsx` contains `import "./index.css";` (the scaffold includes it). If not, add it.

- [ ] **Step 3: Full typecheck + test suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all Vitest suites pass (smoke, store, storage, history, json, JsonTool, registry).

- [ ] **Step 4: Manual end-to-end verification**

Run: `npm run tauri dev` and confirm:

- App opens to the empty-state detail host; sidebar shows **JSON**.
- Clicking **JSON** opens the tool; pasting `{"b":1,"a":2}` and clicking **Format** shows pretty output; invalid JSON shows a red error with line/col.
- **⌘K** opens the palette; typing "json" filters; ↵ opens the tool.
- Hovering a sidebar row reveals the **star**; clicking it pins JSON to a Favorites section; relaunching the app keeps it pinned (persistence works).
- Toggling macOS appearance (System Settings → Appearance) flips the app light/dark.
- Copy `{"x":1}` to the clipboard, switch tools/relaunch — the clipboard banner appears.
- **⌥Space** toggles the window; tray Quit exits.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: assemble app shell with theme, sidebar, detail host, palette, clipboard"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-06-toolkit-design.md`):

| Spec item                                                    | Covered by        |
| ------------------------------------------------------------ | ----------------- | ------- |
| Tauri 2 + React + TS + Vite shell                            | Task 1            |
| Tailwind + shadcn/ui + cmdk                                  | Tasks 3, 16       |
| Tool plugin contract + registry                              | Tasks 6, 12       |
| Zustand store (active/favorites/theme)                       | Task 7            |
| tauri-plugin-store persistence                               | Tasks 8, 19       |
| Per-tool history ring buffer                                 | Task 9            |
| Clipboard smart-detect                                       | Task 17           |
| ⌥Space global hotkey + tray                                  | Task 18           |
| System light/dark theming                                    | Tasks 3, 13       |
| ⌘K command palette                                           | Task 16           |
| JSON tool (format/minify/escape/validate w/ line:col/sort)   | Tasks 10, 11      |
| Pure transforms return `{ok,value}                           | {ok,error}`       | Task 10 |
| Inline error with location; editable input; no crashes       | Tasks 10, 11      |
| Vitest unit tests + RTL smoke + cargo build                  | Tasks 5, 7–12, 18 |
| Empty states                                                 | Tasks 11, 15      |
| Visual tokens (slate + blue/green/red/amber), JetBrains Mono | Task 3            |
| Lucide icons, focus rings, reduced-motion                    | Tasks 3, 11, 14   |

**Deferred (by design, tracked for later plans):** Web Worker pool + Rust `serde_json` fast-path (Phase 3); settings screen (Phase 3); packaging/signing (Phase 3); Base64/URL/Time/Diff (Plan 2); per-tool `escapeJson`/`unescapeJson` surfaced as ⌘K commands (the pure functions exist and are tested in Task 10; surfacing them as palette actions lands with the shared `ToolContext` wiring in Plan 2).

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". The one forward-reference (clipboard `onFill` deep-injection) is explicitly scoped to Plan 2 in Task 17's note, with a concrete behaviour defined for this plan (informational banner). All code steps contain complete code.

**3. Type consistency:** `ToolResult`, `Tool`, `ToolContext` defined once in Task 6 and used unchanged in Tasks 10–12, 16. `pushHistory(list, entry, cap)` (Task 9) matches its hook caller. `storage()`/`setStorageBackend`/`KV` consistent across Tasks 8, 9, 11, 19. `useAppStore` selectors (`activeToolId`, `favorites`, `theme`, `setActiveTool`, `toggleFavorite`, `hydrate`) consistent across Tasks 7, 13, 14, 15, 16, 19. `getTool(id)` accepts `string | null` (Task 12) matching `activeToolId: string | null` usage in Tasks 15, 17. `jsonTool.id === "json"` matches `useHistory("json")` and registry test.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-toolkit-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Note:** Task 0 (Rust toolchain) and the `npm run tauri dev` verification steps are interactive/native and need the user (or a granted-permission shell) to run them on macOS.
