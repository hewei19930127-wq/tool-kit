# Repository Guidelines

## Project Context

ToolKit is a native-feeling macOS desktop toolbox built with Tauri 2, React, TypeScript, Vite, Tailwind CSS v4, Zustand, Biome, and Vitest. It ships ten offline utilities (JSON, Base64, URL, Time, Diff, XML, Radix, Cron, Regex, Color). Most utility logic runs as pure TypeScript in the WebView; Rust stays thin for native shell features (tray, global shortcut, clipboard, eyedropper) plus a fast-path for large JSON/XML transforms. This file is the canonical contributor and architecture guide; `CLAUDE.md` and any other agent entry points point here and add only assistant-specific notes — they should never restate or diverge from these rules.

## Project Structure & Module Organization

Frontend code lives in `src/`: app shell in `src/app/`, shared UI in `src/components/`, state/services in `src/core/`, and utilities in `src/tools/<tool-id>/`. Native Rust code lives in `src-tauri/src/`; Tauri config, capabilities, and icons stay under `src-tauri/`. Specs and plans are under `docs/superpowers/`, with the design spec treated as authoritative.

Each tool follows the plugin pattern: `<tool>.ts` for pure transforms, `<tool>.test.ts` for logic tests, `<Name>Tool.tsx` for UI, `<Name>Tool.test.tsx` for smoke tests, and `index.ts` for the `Tool` definition. Shared hooks live in `src/core/hooks/` (`useToolInput`, `useHistory`, `useTransform`, `useClipboardDetect`), shared UI in `src/components/`, and the size-aware transform pipeline under `src/core/services/transform/`. See Architecture below for how registration, state, and transform routing wire together.

## Architecture

**Registry.** Register a tool by importing it into `src/core/registry.ts` and adding it to the `tools[]` array — that array drives the sidebar, ⌘K command palette, and detail host. The `Tool` contract lives in `src/core/types.ts`: `id`, `name`, `icon`, `keywords`, `component`, optional `detectClipboard`, optional `commands`.

**`ToolResult` contract (do not break).** Pure transforms never throw into the UI. They return the discriminated union from `src/core/types.ts`:

```ts
type ToolResult<T = string> =
  | { ok: true; value: T }
  | { ok: false; error: string; line?: number; col?: number };
```

Catch errors inside the transform, normalize the message with `toMessage()` from `src/core/result.ts`, and return `{ ok: false, error, ...location }`. `OutputPane` renders the union directly — invalid input shows an inline error with line:col where possible and keeps the input editable. JSON's `locate()`/`offsetToLineCol()` in `src/tools/json/json.ts` is the reference for turning a parser error into a line/column.

**State & shared services.** A single Zustand store (`src/core/store.ts`) holds `activeToolId`, `favorites`, `theme`, `hotkey` (default `Alt+Space`), and `toolInputs` (per-tool input text, keyed by tool id). Tools never touch persistence directly; they consume shared hooks in `src/core/hooks/`: `useToolInput` (input bound to the store), `useHistory` (per-tool ring buffer capped at 20, dedup by input — see `pushHistory` in `src/core/services/history.ts`), `useTransform` (size-aware runner), and `useClipboardDetect` (on tool open, runs each tool's `detectClipboard` and surfaces the inline `ClipboardBanner`). Storage (`src/core/services/storage.ts`) is a `KV` abstraction auto-selecting `tauri-plugin-store` (`toolkit.json`) natively or `localStorage` in the browser (detected via `__TAURI_INTERNALS__`); tests inject a fake via `setStorageBackend()`.

**Transform pipeline (size-aware routing).** Heavy, reusable transforms are registered by name in `src/core/services/transform/transforms.ts` (`json.format`, `json.minify`, `json.sortKeys`, `xml.format`, `xml.minify`). `useTransform()` routes them through `route.ts` (`chooseRoute`): the main thread under 50 KB, a Web Worker (`worker.ts` + `pool.ts`) for medium inputs, and the Rust fast-path (`rust.ts` → `invoke`) for inputs ≥ 1 MB on the ops in `RUST_OPS`. The Rust lane falls back to the worker if `invoke` fails, so the browser/dev build still works. The pure transforms remain the source of truth; the worker and Rust lanes only relocate the same work.

**Native (Rust) boundary.** `src-tauri/src/lib.rs` is the entry: it registers plugins, the default `alt+space` global shortcut (toggles the main window like Spotlight), and the tray menu. Modules stay focused: `eyedropper.rs` (`pick_color` via macOS `NSColorSampler`; the frontend `src/tools/color/eyedropper.ts` tries the web `EyeDropper` first and falls back to `invoke("pick_color")`, unreliable in WKWebView), `fastpath.rs` (`json_format`, `json_minify`, `xml_format`, `xml_minify` — the large-transform fast-path), and `settings.rs` (`set_hotkey`, re-registers the global shortcut at runtime; the accelerator persists in the store and is re-applied on boot from `App.tsx`). New app commands must be added to `generate_handler!` in `lib.rs` and need no capability entry — only plugin permissions go in `src-tauri/capabilities/default.json`. Rust unit tests live next to their modules (`cargo test` from `src-tauri/`).

## Build, Test, and Development Commands

- `npm run dev`: start Vite on port `1420`; storage falls back to `localStorage`.
- `npm run tauri dev`: run the full native app; required for hotkey, tray, and native eyedropper testing.
- `npm run tauri build`: build the production native app bundle, including the macOS `.dmg` under `src-tauri/target/release/bundle/dmg/`.
- `npm test`: run Vitest once in CI-style mode.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run build`: run `tsc` strict type checks, then build with Vite.
- `npm run lint`: one-shot Biome lint/format check (run before every commit).
- `npm run lint:fix`: auto-fix Biome lint and format violations.
- `npm run lint:watch`: Biome watch mode (run alongside `npm run dev`).
- `npx vitest run src/tools/json/json.test.ts`: run one test file.
- `cargo test`: run native tests from `src-tauri/`.

## Coding Style & Naming Conventions

Use TypeScript, React JSX, ES modules, and the `@/*` alias for `src/*`. Keep alias config synchronized in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`. **Biome** (`biome.json`) handles lint and formatting — run `npm run lint:fix` after each change and `npm run lint` before every commit. The `tsc` strict gate still applies, including `noUnusedLocals` and `noUnusedParameters` (unused vars/params are hard build errors). UI uses Tailwind v4 semantic tokens, shadcn-style primitives in `src/components/ui/`, and Lucide icons (no emoji). Tool folders use lowercase IDs (`base64`, `json`), PascalCase components (`JsonTool.tsx`), and camelCase functions.

## Testing Guidelines

Tests use Vitest with `jsdom`, Testing Library, and setup in `src/test/setup.ts`. Cover normal cases, invalid input, empty input, Unicode, and large payload behavior for transforms. Pure transforms must return `ToolResult` unions from `src/core/types.ts`; catch errors, normalize with `toMessage()` from `src/core/result.ts`, and do not throw into UI code.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit-style messages such as `feat: implement ToolKit foundation app`, `refactor: dedup error handling`, and `docs: add design spec`. Keep commits focused and imperative. PRs should explain the user-visible change, list tests run, link issues or plans when relevant, and include screenshots or screen recordings for UI changes.

## Security & Configuration Tips

The app is intended to work offline — avoid network calls or heavy dependencies without a clear reason. Tools must use shared hooks for input/history and never touch persistence directly. For the native boundary (module responsibilities, registering app commands, capabilities), see Architecture above.
