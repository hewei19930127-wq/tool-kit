# ToolKit — macOS Personal Developer Toolbox — Design Spec

- **Date:** 2026-06-06
- **Status:** Approved design, ready for implementation planning
- **Author:** Hw93 (with Claude Code, brainstorming session)

## 1. Overview

ToolKit is a native-feeling macOS desktop app that bundles a set of frequently
used developer utilities into one fast, offline, keyboard-driven workspace. It
replaces the scattered web tools and one-off scripts currently used for everyday
encode/decode/format/convert tasks.

The app uses a **sidebar + detail** layout with a **⌘K command palette**. Each
utility is a self-contained "tool" module plugged into a registry, so the set of
tools can grow cheaply over time.

## 2. Goals / Non-Goals

**Goals**

- One home for ~10 common dev utilities, each fast and reliable.
- Fully **offline** — no data leaves the machine.
- Native-feeling macOS app: light/dark following the system, small footprint,
  quick launch, global hotkey.
- **Extensible**: adding a new tool is "drop a module + register it".
- Keyboard-first: ⌘K to jump to any tool/action.

**Non-Goals (for now)**

- App Store distribution / notarized public release (personal use; ad-hoc or
  self-signed build is enough).
- Cloud sync, accounts, or telemetry.
- Natural-language / AI-generated regex (the regex tool ships a curated snippet
  library + tester instead — see §7.9).
- Windows / Linux builds (Tauri keeps this possible later, but out of scope).

## 3. Key Decisions

| Decision           | Choice                                                      | Rationale                                                                                                      |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| App shell          | **Tauri 2**                                                 | Native WKWebView (small RAM, fast start), thin Rust layer, TS frontend aligns with the author's learning goals |
| Layout             | **Sidebar + detail** with **⌘K palette**                    | Several tools (JSON/XML/diff) need real screen space; palette gives fast switching                             |
| UI framework       | **React 18 + TypeScript + Vite**                            | Largest ecosystem, AI-assisted iteration friendly                                                              |
| Components/styling | **Tailwind CSS + shadcn/ui**                                | shadcn ships a `cmdk`-based Command for ⌘K; accessible primitives                                              |
| Editor             | **CodeMirror 6** (incl. merge view for diff)                | Light, themeable, syntax highlight + built-in diff                                                             |
| State              | **Zustand**                                                 | Minimal store for active tool / favorites / theme                                                              |
| Persistence        | **tauri-plugin-store** (JSON KV)                            | Simple local store; SQLite only if history outgrows it                                                         |
| Visual style       | Refined-minimal, technical-precision, **light + dark**      | Native macOS feel                                                                                              |
| Type               | **SF Pro** (system) UI + **JetBrains Mono** editors         | Native UI + distinctive code rendering                                                                         |
| Primary accent     | **macOS blue** (active/primary); green = valid, red = error | Native semantics; green-primary is an easy alternative if preferred later                                      |
| Delivery           | **Phased** — framework + first batch, then the rest         | Validate the plugin pattern early                                                                              |

## 4. Architecture

Two layers with a deliberately thin native shell. Almost all tool logic is pure
string/data processing and lives in TypeScript in the WebView; Rust handles only
what the web cannot (global hotkey, clipboard, window/tray) plus optional native
fast-paths for very large inputs.

```
┌──────────────────────────────────────────────┐
│  React frontend (the whole app, TypeScript)   │
│  ┌────────────┐  ┌──────────────────────────┐ │
│  │  Shell     │  │  Tool modules (×10)       │ │
│  │  sidebar   │  │  json/ base64/ url/ …     │ │
│  │  ⌘K palette│  │  each = metadata + pure   │ │
│  │  theming   │  │  logic + workspace UI     │ │
│  │  detail host│ └──────────────────────────┘ │
│  └────────────┘  ┌──────────────────────────┐ │
│  ┌────────────┐  │  core/ services          │ │
│  │  registry  │  │  history · storage ·     │ │
│  │  (Tool[])  │  │  clipboard · worker pool │ │
│  └────────────┘  └──────────────────────────┘ │
└───────────────────────┬──────────────────────┘
                         │ Tauri IPC
┌───────────────────────┴──────────────────────┐
│  Rust shell (thin): global hotkey · clipboard │
│  read · window show/hide/tray · OPTIONAL native│
│  fast-paths (serde_json/quick-xml) + eyedropper│
└──────────────────────────────────────────────┘
```

### 4.1 The Tool contract

Every tool is a self-contained module implementing one interface. Adding a tool
= add a folder + register it.

```ts
type ToolCategory = "encode-text" | "convert-other";

interface ToolCommand {
  id: string;
  title: string; // shown in ⌘K
  run(ctx: ToolContext): void;
}

interface Tool {
  id: string; // "json"
  name: string; // display name, e.g. "JSON 格式化"
  category: ToolCategory;
  icon: LucideIcon;
  keywords: string[]; // fuel for ⌘K fuzzy search
  component: React.ComponentType; // the workspace UI
  detectClipboard?(text: string): boolean; // smart-detect banner
  commands?: ToolCommand[]; // extra actions surfaced in ⌘K
}
```

The **registry** is `Tool[]`. The shell builds the sidebar from it, ⌘K
fuzzy-searches `name + keywords + commands`, and the detail host mounts
`activeTool.component`. Tools never touch persistence directly — they consume
shared hooks (`useHistory(toolId)`, `useClipboardDetect`, `runInWorker(fn)`),
keeping each tool isolated and independently unit-testable.

### 4.2 Project structure

```
src/
  app/            shell: layout, sidebar, command-palette, theme provider
  core/           registry, Tool types, services (storage, history,
                  clipboard, worker-pool), zustand store
  tools/
    json/
      index.ts        Tool definition (metadata + component wiring)
      json.ts         pure transforms: format/minify/escape  ← unit tested
      json.test.ts
      JsonTool.tsx    workspace component
    base64/  url/  time/  diff/  xml/  radix/  cron/  regex/  color/
  components/ui/  shadcn primitives (Command, Dialog, Button…)
src-tauri/        Rust commands, global-shortcut, tray, window
```

### 4.3 State & data flow

- A small **Zustand** store holds `activeToolId`, `favorites[]`, `theme`.
- Per-tool **history** is a capped ring buffer (last ~20 entries) persisted via
  **tauri-plugin-store** (`toolkit.json`).
- Flow inside a tool:
  `input → (Web Worker if heavy / Rust if very large) → pure transform →
{ok, value | error} → output + status line`.
- On tool open, the shell reads the clipboard (Rust), runs
  `tool.detectClipboard`, and shows the inline "fill from clipboard" banner if
  it matches.

## 5. Cross-cutting features

- **⌘K command palette** — `cmdk` (via shadcn Command); searches tools + recent
  - per-tool commands; ↑↓ navigate, ↵ open, esc close.
- **Favorites / pinning** — pinned tools appear in a top sidebar section;
  persisted in the store.
- **History** — per-tool ring buffer of recent inputs/results, one-click
  restore; persisted locally.
- **Clipboard smart-detect** — on tool open, detect clipboard content type
  (JSON/URL/timestamp/…) and offer to fill or suggest a tool. Inline banner, not
  a popup.
- **Global hotkey** — `tauri-plugin-global-shortcut`, default `⌥Space`
  (configurable), toggles the window like Spotlight.
- **Theming** — follow system light/dark via the Tauri window theme + CSS
  tokens; both themes designed together.

## 6. Visual design

- **Style:** refined-minimal / technical-precision, native macOS feel.
- **Palette (semantic tokens, light + dark):** slate neutrals; **blue** =
  active/primary, **green** = valid/success, **red** = error, **amber** =
  favorite star.
- **Typography:** SF Pro (system) for UI with Inter fallback; **JetBrains Mono**
  for editor panes; tabular numerals for data columns.
- **Density:** 4/8px spacing scale, ~30px sidebar rows, hairline dividers,
  hierarchy via weight + spacing (not heavy borders).
- **Icons:** Lucide SVG set, one consistent stroke width. No emoji as icons.
- **UX musts:** visible focus rings, helpful empty states, skeleton/inline
  progress for ops > 300 ms, full keyboard navigation, `prefers-reduced-motion`
  respected.

## 7. Tool specifications

Each tool = a pure logic file (unit tested) + a workspace component. Library
picks favor small, mature, offline packages.

| #   | Tool           | Functions                                                                                     | Library / approach                                                                              |
| --- | -------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **JSON**       | format / minify / escape / unescape; validate with line:col error; sort keys (opt)            | native `JSON`; **serde_json** (Rust) fast-path for >1 MB                                        |
| 2   | **Base64**     | encode / decode, UTF-8-safe, URL-safe variant toggle                                          | native `atob/btoa` + `TextEncoder/Decoder`                                                      |
| 3   | **URL**        | encode/decode (component & full); query-param table view                                      | native `URL` + `encodeURIComponent`                                                             |
| 4   | **Time**       | epoch ↔ ISO ↔ custom format; timezone convert; relative ("3h ago"); now                       | **day.js** + `utc`/`timezone` plugins                                                           |
| 5   | **Diff**       | line / word / char diff, side-by-side + inline                                                | **CodeMirror 6 merge** view                                                                     |
| 6   | **XML**        | format / minify; validate well-formedness                                                     | **fast-xml-parser**; **quick-xml** (Rust) fast-path for large                                   |
| 7   | **Radix/进制** | bin/oct/dec/hex + arbitrary base 2–36; **BigInt**; bitwise view                               | native `parseInt`/`toString` + `BigInt`                                                         |
| 8   | **Cron**       | parse → human description + next N run times; field builder UI                                | **cronstrue** + **cron-parser**                                                                 |
| 9   | **Regex**      | live test against sample text, match/group highlight, flags; **snippet library** + cheatsheet | native `RegExp`                                                                                 |
| 10  | **Color**      | hex ⇄ rgb ⇄ hsl ⇄ hsv; contrast checker; screen **eyedropper**                                | **colord**; eyedropper via **Rust `NSColorSampler`** (web `EyeDropper` unreliable in WKWebView) |

### 7.9 Regex scope note

The regex tool ships a **curated snippet library + cheatsheet + live tester**,
not natural-language/AI generation. This keeps it deterministic and offline.
NL→regex could be added later as a separate (likely online) feature.

## 8. Error handling

- Transforms are **pure** and return `{ ok: true, value } | { ok: false, error }`
  — they never throw into the UI.
- Invalid input → **inline error with location** (line:col where possible); the
  input pane stays editable; output shows the error state. No crashes, no silent
  failures.
- Worker / IPC failures → caught and surfaced as a toast with retry; the app
  stays usable.
- Each tool has a **helpful empty state** (what to paste / an example), never a
  blank pane.

## 9. Testing

- **Vitest** unit tests on every pure logic file (`json.ts`, `base64.ts`, …) —
  the bulk of correctness; edge cases: empty, malformed, huge, unicode.
- Light **React Testing Library** smoke tests per tool component (renders + a
  happy-path run).
- **`cargo test`** for Rust commands (clipboard, eyedropper, fast-paths).
- Manual verification on macOS for native bits: global hotkey, tray, theme
  switching.

## 10. Performance budget

- Never block the UI thread — heavy transforms run in a **Web Worker**; route to
  the **Rust fast-path** above a size threshold (~1 MB).
- Targets: format 1 MB JSON < 100 ms; UI stays 60 fps; cold start < ~1 s
  (WKWebView).
- Sidebar / ⌘K search over the tool set is an in-memory fuzzy match (trivial).

## 11. Phasing

- **Phase 1 — framework + first batch:** scaffold (Tauri + React + Tailwind +
  shadcn) · shell (sidebar, detail host, theming) · registry + Tool contract ·
  ⌘K · the 4 cross-cutting services (favorites, history, clipboard-detect,
  global hotkey) · **tools: JSON, Base64, URL, Time, Diff**.
- **Phase 2 — remaining tools:** XML, Radix, Cron, Regex, Color (incl. native
  eyedropper).
- **Phase 3 — polish:** worker pool + Rust fast-paths, settings screen,
  packaging/signing (personal ad-hoc / self-signed).

## 12. Risks & open items

- **Screen eyedropper** needs a small native Rust command (`NSColorSampler`);
  web `EyeDropper` is unreliable in WKWebView. Scoped to Phase 2.
- **Large-input performance** mitigated by worker + Rust fast-path; thresholds
  to be tuned during Phase 3.
- **Code signing** for personal distribution: ad-hoc / self-signed is assumed;
  revisit if the app is ever shared.
- **Rust toolchain** must be installed for Tauri builds (one-time setup).
