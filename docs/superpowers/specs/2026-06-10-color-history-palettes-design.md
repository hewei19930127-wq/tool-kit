# Color Tool: Saved Color History + Preset Palettes

**Date:** 2026-06-10
**Status:** Approved design

## Summary

Two additions to the Color tool (`src/tools/color/`):

1. **Color history** — an explicit "save" button stores the current color; saved colors render
   as a clickable swatch strip for quick reuse, persisted via the existing shared history hook.
2. **Preset palettes** — a collapsible in-page "Color sets" section with two built-in palettes
   (Tailwind CSS and Material Design) rendered as hue-row swatch grids; clicking a swatch fills
   the input.

No new persistence mechanisms, no Rust changes, no changes to `color.ts` transforms.

## Motivation

The Color tool today is stateless across uses: a picked or typed color is lost as soon as the
input changes. Users who eyedrop colors from designs have no way to get back to a color from
five minutes ago, and there is no quick source of common, known-good colors. Reusing the
existing `useHistory` infrastructure plus a static palette dataset solves both with minimal new
machinery.

## Current State (baseline)

- `ColorTool.tsx`: input row (text input bound via `useToolInput("color")`, eyedropper button,
  swatch preview), parsed model rows (hex/rgb/hsl/hsv), and a contrast checker. Root container
  is `flex h-full flex-col gap-4 p-4` (no scroll handling).
- `color.ts`: pure `parseColor`, `contrastRatio`, `wcagLevels` — **unchanged by this work**.
- Shared history: `useHistory(toolId)` (`src/core/hooks/useHistory.ts`) persists a per-tool
  `HistoryEntry[]` (`{ input, output, ts }`) under storage key `history:color`, capped at 20,
  deduped by `input` via `pushHistory`. The Color tool does not use it yet.
- `HistoryButton` (`src/components/HistoryButton.tsx`) is a text-preview dropdown — not suited
  to colors, where the swatch *is* the preview. It is **not** reused here.

## Design

### 1. Color history (explicit save)

**Recording.** A new "save" button sits in the input row next to the eyedropper button. It is
disabled unless the current input parses (`models?.ok`). Clicking it calls
`record(models.value.hex, models.value.hex)` from `useHistory("color")`.

- The **normalized hex** is stored as both `input` and `output`, so `rgb(255, 0, 0)` and
  `#ff0000` dedupe to one entry and restore deterministically.
- Eyedropper picks and typing do **not** auto-record (decided: explicit save only).
- Cap/dedup/persistence come from `pushHistory` + the hook; no new storage code.

**Display.** A swatch strip renders between the input row and the model rows, hidden when
history is empty:

- One button per entry (newest first, as the hook returns them): a small rounded swatch
  (~`h-7 w-7`) with `style={{ background: entry.input }}`, `title` = hex, and an aria-label
  including the hex.
- Clicking a swatch calls `setInput(entry.input)` — the model rows and preview update through
  the existing flow.
- No delete/clear controls (out of scope); the 20-entry cap bounds growth.

### 2. Preset palettes

**Data — `src/tools/color/palettes.ts` (new).** Static, offline data:

```ts
export interface PaletteColor { name: string; hex: string }   // e.g. { name: "red-500", hex: "#ef4444" }
export interface PaletteGroup { name: string; colors: PaletteColor[] }  // one hue, e.g. "red"
export interface Palette {
  id: "tailwind" | "material";
  nameKey: string;              // i18n key for the tab label
  groups: PaletteGroup[];
}
export const palettes: Palette[];
```

- **Tailwind**: the Tailwind CSS v4 default palette — 22 hue ramps × 11 shades (50–950),
  names like `red-500`.
- **Material**: the Material Design 2014 palette — 19 hues × 10 shades (50–900), names like
  `Red 500`. Accent variants (`A100`–`A700`) are excluded.
- Hex values are hardcoded; the dataset is pure data with no imports beyond types.

**UI.** A "Color sets" section below the contrast checker:

- A header row with a chevron toggle (collapsible, **expanded by default**, local
  `useState` — collapse state is not persisted).
- Tab buttons for Tailwind / Material (local `useState`, default `tailwind`), styled like the
  Diff tool's mode toggle.
- The active palette renders one row per `PaletteGroup`: the hue name on the left
  (fixed-width, muted), then the shade swatches in order. Each swatch is a button with
  `title` = `"{name} {hex}"` and an aria-label of the color name; clicking calls
  `setInput(hex)`.
- The root container of `ColorTool` gains `overflow-y-auto` so the grid scrolls with the page.

### 3. i18n

Add to both `en.ts` and `zh-CN.ts`:

- `tools.color.save` — save-to-history button label
- `tools.color.history` — history strip aria-label/heading
- `tools.color.palettes` — "Color sets" section title
- `tools.color.paletteTailwind` / `tools.color.paletteMaterial` — tab labels

## Out of Scope (YAGNI)

- User-defined color collections (decided: built-in only).
- Auto-recording on eyedropper pick or while typing (decided: explicit save).
- History delete/clear, reordering, or raising the 20-entry cap.
- Palette search/filtering, favorites within palettes, Material accent shades.
- Any change to `color.ts`, `eyedropper.ts`, the store, or the Rust side.

## Testing

- **`palettes.test.ts` (new):** every `hex` in every palette parses via `parseColor`; color
  names are unique within each palette; Tailwind groups have 11 colors and Material groups 10.
- **`ColorTool.test.tsx` (extended):** save button disabled for empty/invalid input; saving a
  valid color renders a history swatch; clicking a history swatch restores the input;
  switching palette tabs swaps the grid; clicking a palette swatch sets the input to its hex.
  Tests use the existing `setStorageBackend()` fake.
- Existing `color.test.ts` is untouched.

## Acceptance Criteria

1. With a valid color in the input, clicking save adds a swatch to the history strip; the
   strip is hidden when history is empty.
2. Saving the same color twice (in any format) yields one history entry; history survives an
   app restart and caps at 20.
3. Clicking a history swatch fills the input and updates the model rows and preview.
4. The "Color sets" section shows Tailwind and Material tabs; clicking any swatch fills the
   input with its hex; hover shows the color name and hex.
5. The section collapses/expands via its header toggle.
6. `npm run lint` and `npm test` pass; `color.ts` and `eyedropper.ts` are unchanged.
