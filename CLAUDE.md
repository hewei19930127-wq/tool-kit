# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ToolKit is a native-feeling **macOS desktop app** (Tauri 2) bundling ~10 offline developer
utilities behind a sidebar + ⌘K command palette. Almost all logic is pure TypeScript running
in the WebView; the Rust shell is deliberately thin (global hotkey, tray, clipboard, native
eyedropper). The authoritative design is `docs/superpowers/specs/2026-06-06-toolkit-design.md`;
phased implementation plans live alongside it under `docs/superpowers/plans/`.

## Commands

```bash
npm run dev          # Vite dev server in the browser (port 1420, storage falls back to localStorage)
npm run tauri dev    # full native app — requires Rust/Cargo on PATH (rustup); only way to test hotkey/tray/eyedropper
npm run tauri build  # production native app bundle, including macOS .dmg under src-tauri/target/release/bundle/dmg/
npm test             # vitest run (one-shot, CI-style)
npm run test:watch   # vitest in watch mode
npm run build        # tsc (type-check) THEN vite build — a type error fails the build
npm run lint:watch   # Biome watch — run in a second terminal alongside npm run dev
npm run lint:fix     # auto-fix all lint + format violations
npm run lint         # one-shot lint check (run before every commit)
```

- Run one test file: `npx vitest run src/tools/json/json.test.ts`
- Run tests by name: `npx vitest run -t "formats nested objects"`
- Rust tests: `cargo test` from `src-tauri/` (native commands).

**Biome** handles lint and formatting (`biome.json`). **Code quality rule: after each code change run `npm run lint:fix` to auto-fix; before every commit run `npm run lint` to confirm zero violations.** The TypeScript quality gate (`tsc` strict, `noUnusedLocals`, `noUnusedParameters`) still applies — unused variables/params are hard build errors.

## Architecture

### The tool plugin pattern (the core idea)

Every utility is a self-contained module under `src/tools/<id>/`. Adding a tool = create the
folder + add it to one array. A tool folder has four files:

- `<name>.ts` — **pure transforms**, the unit-tested heart of the tool.
- `<name>.test.ts` — Vitest unit tests for that logic (edge cases: empty, malformed, huge, unicode).
- `<Name>Tool.tsx` — the workspace React component (wires logic to UI via shared hooks).
- `<Name>Tool.test.tsx` — a light React Testing Library smoke test.
- `index.ts` — the `Tool` definition (metadata + component wiring), exported as `<id>Tool`.

Register the new tool by importing it into `src/core/registry.ts` and adding it to the `tools[]`
array — that array drives the sidebar, ⌘K search, and the detail host. The `Tool` contract is in
`src/core/types.ts` (`id`, `name`, `icon`, `keywords`, `component`, optional `detectClipboard`,
optional `commands`).

### The `ToolResult` convention (do not break this)

Pure transforms **never throw into the UI**. They return a discriminated union from
`src/core/types.ts`:

```ts
type ToolResult<T = string> =
  | { ok: true; value: T }
  | { ok: false; error: string; line?: number; col?: number };
```

Catch errors inside the transform, normalize the message with `toMessage()` from
`src/core/result.ts`, and return `{ ok: false, error, ...location }`. The component renders the
union directly (see `OutputPane`); invalid input shows an inline error with line:col where possible
and keeps the input editable. JSON's `locate()`/`offsetToLineCol()` in `src/tools/json/json.ts` is
the reference implementation for turning a parser error into a line/column.

### Shell, state, and shared services

- **Shell** (`src/app/`): `Sidebar`, `DetailHost` (mounts `activeTool.component`), `CommandPalette`
  (`cmdk`-based ⌘K), `ThemeProvider`, `ClipboardBanner`. `App.tsx` hydrates persisted state on
  boot and subscribes the store to persist `favorites`/`theme`.
- **State** (`src/core/store.ts`): a single Zustand store — `activeToolId`, `favorites`, `theme`,
  and `toolInputs` (per-tool input text, keyed by tool id).
- **Tools never touch persistence directly.** They consume shared hooks: `useToolInput(toolId)`
  (input bound to the store), `useHistory(toolId)` (per-tool ring buffer, capped at 20, dedup by
  input — see `pushHistory` in `src/core/services/history.ts`).
- **Storage** (`src/core/services/storage.ts`): a `KV` abstraction with two auto-selected backends
  — `tauri-plugin-store` (`toolkit.json`) when running natively, `localStorage` in the browser
  (detected via `__TAURI_INTERNALS__`). Tests inject a fake via `setStorageBackend()`.
- **Clipboard smart-detect** (`useClipboardDetect`): on tool open, reads the clipboard and runs
  each tool's `detectClipboard(text)`; matches surface the inline `ClipboardBanner` (fill the
  active tool, or suggest+open another tool).

### Native (Rust) boundary

`src-tauri/src/lib.rs` is the entry: registers plugins, the `alt+space` global shortcut (toggles
the main window like Spotlight), and the tray menu. `eyedropper.rs` exposes the `pick_color`
command via macOS `NSColorSampler`. Frontend code calls native features through `@tauri-apps/api`
`invoke` — see `src/tools/color/eyedropper.ts`, which tries the web `EyeDropper` first and falls
back to `invoke("pick_color")` (web EyeDropper is unreliable in WKWebView). New native commands
must be added to `generate_handler!` in `lib.rs` and granted permission in
`src-tauri/capabilities/default.json`.

## Conventions

- **Path alias `@/*` → `src/*`** is configured in three files that must stay in sync:
  `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`.
- UI uses Tailwind v4 + shadcn primitives (new-york style, slate base) in `src/components/ui/`;
  semantic color tokens (`bg-primary`, `text-muted-foreground`, etc.), Lucide icons, no emoji.
- Keep new dependencies small, mature, and offline — this app makes no network calls by design.
