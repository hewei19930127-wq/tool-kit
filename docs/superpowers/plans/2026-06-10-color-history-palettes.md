# Color History + Preset Palettes Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run `npm run lint:fix` after each change and `npm run lint` + `npm test` before committing. Honor the `ToolResult` contract and the `@/*` alias sync rule from `AGENTS.md`.

**Goal:** Add an explicit-save **color history** (swatch strip, persisted via the shared `useHistory` hook) and a collapsible **"Color sets"** section with built-in Tailwind CSS and Material Design palettes to the Color tool. Clicking any swatch fills the input.

**Architecture:** No new persistence and no store changes — history reuses `useHistory("color")` (`history:color` key, cap 20, dedup by input; normalized hex stored). Palettes are static data in a new `palettes.ts`. All changes are confined to `src/tools/color/` plus i18n message files. `color.ts` and `eyedropper.ts` are untouched.

**Tech Stack:** Existing only (React 18, TS, Tailwind v4 tokens, Lucide icons, Vitest + Testing Library). No new dependencies.

> **Source spec:** `docs/superpowers/specs/2026-06-10-color-history-palettes-design.md`. **Mockup:** `docs/superpowers/mockups/color-history-palettes-mockup.html`.

> **Out of scope (do NOT build):** custom user collections, auto-record on pick/typing, history delete/clear, palette search, Material accent shades (`A100`–`A700`), any change to `color.ts` / `eyedropper.ts` / the store / Rust.

---

## File Structure

| Path                                   | Responsibility                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/tools/color/palettes.ts`          | **Create:** `PaletteColor`/`PaletteGroup`/`Palette` types + `palettes` static data    |
| `src/tools/color/palettes.test.ts`     | **Create:** every hex parses; names unique per palette; group sizes (TW 11, MD 10)   |
| `src/tools/color/ColorTool.tsx`        | **Modify:** save button, history swatch strip, collapsible Color sets section        |
| `src/tools/color/ColorTool.test.tsx`   | **Modify:** save/restore/palette smoke tests                                         |
| `src/core/i18n/messages/en.ts`         | **Modify:** `tools.color.save/history/palettes/paletteTailwind/paletteMaterial`      |
| `src/core/i18n/messages/zh-CN.ts`      | **Modify:** same keys, Chinese copy                                                  |

---

## Task 1: Palette dataset (`palettes.ts` + tests)

**Files:** Create `src/tools/color/palettes.ts`, `src/tools/color/palettes.test.ts`.

- [ ] **Step 1: Types + data.**

```ts
export interface PaletteColor { name: string; hex: string }
export interface PaletteGroup { name: string; colors: PaletteColor[] }
export interface Palette {
  id: "tailwind" | "material";
  nameKey: string; // "tools.color.paletteTailwind" | "tools.color.paletteMaterial"
  groups: PaletteGroup[];
}
export const palettes: Palette[] = [tailwindPalette, materialPalette];
```

Build groups from compact `[hue, hexes[]]` source arrays (hex data exists in the mockup HTML — copy from there):
- **Tailwind:** 22 hues × 11 shades (`50`–`950`), color names like `red-500`.
- **Material:** 19 hues × 10 shades (`50`–`900`), color names like `Red 500`.
Pure data module — no imports beyond local types.

- [ ] **Step 2: Tests** (`palettes.test.ts`): every `hex` parses via `parseColor` from `./color`; names are unique within each palette; every Tailwind group has 11 colors and every Material group 10; palette ids are `tailwind` and `material`.

- [ ] **Step 3:** `npm run lint:fix` && `npx vitest run src/tools/color/palettes.test.ts`.

---

## Task 2: i18n keys

**Files:** Modify `src/core/i18n/messages/en.ts`, `src/core/i18n/messages/zh-CN.ts`.

- [ ] **Step 1:** Add to the `tools.color.*` block in both locales:
  - `tools.color.save` — `"Save"` / `"保存"`
  - `tools.color.history` — `"History"` / `"历史"`
  - `tools.color.palettes` — `"Color sets"` / `"颜色集合"`
  - `tools.color.paletteTailwind` — `"Tailwind"` (both)
  - `tools.color.paletteMaterial` — `"Material"` (both)

- [ ] **Step 2:** `npm run lint:fix` && `npm test` (the i18n parity test, if present, must pass).

---

## Task 3: History save button + swatch strip in `ColorTool.tsx`

**Files:** Modify `src/tools/color/ColorTool.tsx`, `src/tools/color/ColorTool.test.tsx`.

- [ ] **Step 1: Hook + save button.** Call `useHistory("color")`. Add a save button (Lucide `Save` icon, label `t("tools.color.save")`) in the input row before the eyedropper button, `disabled={!models?.ok}`; `onClick` → `record(models.value.hex, models.value.hex)` (normalized hex both sides → cross-format dedup).

- [ ] **Step 2: Swatch strip.** Between the input row and the model rows, when `entries.length > 0`, render a flex-wrap row: muted `t("tools.color.history")` label + one button per entry — `h-7 w-7 rounded-md border border-border`, `style={{ background: entry.input }}`, `title={entry.input}`, `aria-label` = `` `${t("tools.color.history")} ${entry.input}` ``, `onClick` → `setInput(entry.input)`.

- [ ] **Step 3: Tests.** In `ColorTool.test.tsx`, inject a fake storage backend (`setStorageBackend()` per existing test patterns) in `beforeEach`. Cover: save disabled for empty input; typing `#ff0000` then clicking save renders one history swatch (`findBy` — storage load is async); saving the same color twice keeps one entry; clicking the swatch after changing the input restores `#ff0000`.

- [ ] **Step 4:** `npm run lint:fix` && `npx vitest run src/tools/color/ColorTool.test.tsx`.

---

## Task 4: Color sets section in `ColorTool.tsx`

**Files:** Modify `src/tools/color/ColorTool.tsx`, `src/tools/color/ColorTool.test.tsx`.

- [ ] **Step 1: Section shell.** Below the contrast checker, add a bordered section matching the contrast checker's styling. Header: a button toggling local `expanded` state (default `true`) with a Lucide `ChevronDown` (rotated when collapsed) + `t("tools.color.palettes")` title; on the right, one tab button per palette from `palettes` (label `t(p.nameKey)`, active = `bg-muted`, local `activePaletteId` state, default `"tailwind"`).

- [ ] **Step 2: Grid.** When expanded, render the active palette's groups: one flex row per `PaletteGroup` — fixed-width muted group name (`w-24 font-mono text-xs`), then `flex-1` cells (`flex gap-1`): each color a `flex-1 h-6 rounded` button with `style={{ background: c.hex }}`, `title={`${c.name} ${c.hex}`}`, `aria-label={c.name}`, `onClick` → `setInput(c.hex)`.

- [ ] **Step 3: Scroll.** Change the root container to `overflow-y-auto` so the page scrolls.

- [ ] **Step 4: Tests.** Section title renders; clicking the `red-500` swatch sets the input to `#ef4444`; switching to the Material tab renders `Red 500`; collapsing hides the grid.

- [ ] **Step 5:** `npm run lint:fix` && `npx vitest run src/tools/color/ColorTool.test.tsx`.

---

## Task 5: Final verification + commit

- [ ] **Step 1:** `npm run lint` && `npm test` (full suite) && `npm run build` (tsc strict gate).
- [ ] **Step 2:** Walk the spec's Acceptance Criteria 1–6 against the implementation.
- [ ] **Step 3:** Commit `feat: add color history and preset palettes to the color tool` (Color-tool files + i18n only; pre-existing unrelated working-tree changes stay uncommitted).
