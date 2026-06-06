# Repository Guidelines

## Project Context

ToolKit is a native-feeling macOS desktop toolbox built with Tauri 2, React, TypeScript, Vite, Tailwind CSS, Zustand, and Vitest. Most utility logic runs as pure TypeScript in the WebView; Rust should stay thin for native shell features such as tray, global shortcut, clipboard, and eyedropper. Keep this file semantically aligned with `CLAUDE.md`; that file may contain the longer explanation, but rules should not diverge.

## Project Structure & Module Organization

Frontend code lives in `src/`: app shell in `src/app/`, shared UI in `src/components/`, state/services in `src/core/`, and utilities in `src/tools/<tool-id>/`. Native Rust code lives in `src-tauri/src/`; Tauri config, capabilities, and icons stay under `src-tauri/`. Specs and plans are under `docs/superpowers/`, with the design spec treated as authoritative.

Each tool follows the plugin pattern: `<tool>.ts` for pure transforms, `<tool>.test.ts` for logic tests, `<Name>Tool.tsx` for UI, `<Name>Tool.test.tsx` for smoke tests, and `index.ts` for the `Tool` definition. Register tools in `src/core/registry.ts`; that drives the sidebar, command palette, and detail host.

## Build, Test, and Development Commands

- `npm run dev`: start Vite on port `1420`; storage falls back to `localStorage`.
- `npm run tauri dev`: run the full native app; required for hotkey, tray, and native eyedropper testing.
- `npm run tauri build`: build the production native app bundle, including the macOS `.dmg` under `src-tauri/target/release/bundle/dmg/`.
- `npm test`: run Vitest once in CI-style mode.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run build`: run `tsc` strict type checks, then build with Vite.
- `npx vitest run src/tools/json/json.test.ts`: run one test file.
- `cargo test`: run native tests from `src-tauri/`.

## Coding Style & Naming Conventions

Use TypeScript, React JSX, ES modules, and the `@/*` alias for `src/*`. Keep alias config synchronized in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`. There is no ESLint, Prettier, or Biome; `tsc` strict mode is the main gate, including `noUnusedLocals` and `noUnusedParameters`. UI uses Tailwind v4 semantic tokens, shadcn-style primitives in `src/components/ui/`, and Lucide icons. Tool folders use lowercase IDs (`base64`, `json`), PascalCase components (`JsonTool.tsx`), and camelCase functions.

## Testing Guidelines

Tests use Vitest with `jsdom`, Testing Library, and setup in `src/test/setup.ts`. Cover normal cases, invalid input, empty input, Unicode, and large payload behavior for transforms. Pure transforms must return `ToolResult` unions from `src/core/types.ts`; catch errors, normalize with `toMessage()` from `src/core/result.ts`, and do not throw into UI code.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit-style messages such as `feat: implement ToolKit foundation app`, `refactor: dedup error handling`, and `docs: add design spec`. Keep commits focused and imperative. PRs should explain the user-visible change, list tests run, link issues or plans when relevant, and include screenshots or screen recordings for UI changes.

## Security & Configuration Tips

The app is intended to work offline. Avoid network calls or heavy dependencies without a clear reason. Tools should use shared hooks for input/history and must not touch persistence directly. For new native commands, update both `generate_handler!` in `src-tauri/src/lib.rs` and permissions in `src-tauri/capabilities/default.json`.
