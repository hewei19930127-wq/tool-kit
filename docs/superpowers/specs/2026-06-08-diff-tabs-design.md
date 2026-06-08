# Diff Tool: Split-as-Default + Multi-Tab Comparisons

**Date:** 2026-06-08
**Status:** Approved design
**Mockup:** `docs/superpowers/mockups/diff-tabs-mockup.html`

## Summary

Two changes to the Diff tool (`src/tools/diff/`):

1. **Split view becomes the default** output layout (currently defaults to inline).
2. **Multiple comparison tabs** — users can open several independent Original/Changed
   comparisons in one Diff tool, switch between them, and have them persist across restarts.

Diff mode (line/word/char) and view (inline/split) become **global, persisted** settings shared
across all tabs.

## Motivation

The Diff tool today holds a single comparison: two textareas backed by `toolInputs["diff:a"]` and
`toolInputs["diff"]`, with `mode` and `view` as local component state that reset on every mount.
Users comparing several pairs must overwrite their inputs and lose the previous comparison. Split
view is the more useful default for side-by-side review but is currently one extra click every
session.

## Current State (baseline)

- `DiffTool.tsx`: two `<textarea>`s bound via `useToolInput("diff:a")` / `useToolInput("diff")`,
  a mode toggle (line/word/char) and a view toggle (inline/split), both `useState` (not persisted).
  Inline renders a `<pre>` of diff parts; split mounts a CodeMirror `MergeView`.
- `diff.ts`: pure `computeDiff(a, b, mode)` and `diffStats(parts)` — **unchanged by this work**.
- Store (`src/core/store.ts`): single Zustand store. `toolInputs` is **in-memory only** — it is
  *not* part of the persisted slice. App.tsx persists/hydrates only `favorites`, `theme`,
  `language`, `hotkey`.
- Persistence wiring lives in `src/App.tsx`: a boot effect loads keys from `storage()` and calls
  `hydrate()`; a `useAppStore.subscribe` effect writes keys back on change.

Because `toolInputs` is not persisted, there is **no on-disk diff data to migrate**. Existing
in-memory keys `"diff:a"` / `"diff"` simply become unused.

## Design

### 1. State model — new `diff` slice in the Zustand store

```ts
interface DiffTab {
  id: string;        // stable unique id
  label: string;     // "Diff 1", "Diff 2", ... (from nextSeq at creation)
  a: string;         // Original input
  b: string;         // Changed input
}

interface DiffSlice {
  tabs: DiffTab[];               // invariant: length >= 1
  activeTabId: string;           // always references an existing tab
  nextSeq: number;               // monotonic counter powering labels
  mode: DiffMode;                // global, default "line"
  view: "inline" | "split";      // global, default "split"
}
```

Added to `AppState` as `diff: DiffSlice`.

**Initial / default slice** (used when storage is empty):

```ts
{
  tabs: [{ id: <generated>, label: "Diff 1", a: "", b: "" }],
  activeTabId: <that id>,
  nextSeq: 2,
  mode: "line",
  view: "split",
}
```

**Actions** (added to the store):

- `addDiffTab()` — push `{ id, label: "Diff " + nextSeq, a: "", b: "" }`, increment `nextSeq`,
  set it active.
- `closeDiffTab(id)` — remove the tab. Invariants:
  - never drop below one tab (closing the last tab is a no-op; the UI hides the control then).
  - if the closed tab was active, activate its neighbor (prefer the previous index, else the next).
- `setActiveDiffTab(id)`.
- `setDiffTabSide(id, side, text)` — `side` is `"a" | "b"`; updates that tab immutably.
- `setDiffMode(mode)`, `setDiffView(view)` — global toggles.

**Label rule:** labels are assigned from `nextSeq` at creation and never recomputed. Closing
"Diff 2" leaves "Diff 3" labelled "Diff 3" — stable identity, no renumbering. (The mockup shows
`Diff 1, Diff 2, Diff 4` after Diff 3 was closed.)

`id` generation uses `crypto.randomUUID()` (available in the WebView). The store remains free of
`Date.now()`/`Math.random()` ordering assumptions.

### 2. Persistence (`src/App.tsx` + `store.ts`)

- Single storage key **`"diff"`** holds the entire slice `{ tabs, activeTabId, nextSeq, mode, view }`
  — one atomic read/write, consistent with the existing per-key pattern.
- **Boot hydrate:** add `storage().get<DiffSlice>("diff")` to the `Promise.all`; pass it to
  `hydrate()` when present. When absent or malformed, the store keeps its default slice.
- **Save:** add `void storage().set("diff", state.diff)` to the `subscribe` effect.
- Extend the `hydrate` parameter type in `store.ts` to include `diff`.
- **Hydration hardening:** validate the loaded slice minimally — if `tabs` is empty or
  `activeTabId` does not match any tab, fall back to defaults (or repair `activeTabId` to
  `tabs[0].id`). This keeps the `length >= 1` and valid-active invariants even against stale data.

### 3. UI

**`DiffTabs.tsx` (new, focused component).** The tab strip rendered above the toolbar:

- A row of tab buttons showing each `label`; the active tab is highlighted.
- Each tab has a hover `×` to close, **hidden when `tabs.length === 1`**.
- A trailing `+` button (aria-label "new comparison") calls `addDiffTab()`.
- Props are minimal — reads tabs/activeTabId from the store via selectors, calls store actions.
  Keep it presentational enough to smoke-test in isolation.

**`DiffTool.tsx` (refactored).** Drops `useToolInput` entirely. It:

- selects the active tab (`tabs.find(t => t.id === activeTabId)`) plus global `mode` / `view`.
- renders `<DiffTabs />`, then the existing toolbar (mode/view buttons now driven by `setDiffMode` /
  `setDiffView`), then the two editors bound to the active tab via `setDiffTabSide`, then the diff
  output.
- computes `parts`/`stats` from the **active tab's** `a`/`b` (memoized as today).
- inline branch and the `MergeView` split branch are unchanged in behavior; only their input source
  changes to the active tab.

The toolbar, stats, and `MergeView` effect logic are otherwise preserved.

### 4. i18n

Add keys (both `en` and existing locales) for:

- new-comparison button aria-label (e.g. `tools.diff.tab.new`)
- close-tab button aria-label (e.g. `tools.diff.tab.close`)
- tab label prefix / format (e.g. `tools.diff.tab.label` → `"Diff {n}"`), so numbering localizes.

Existing `tools.diff.mode.*` and `tools.diff.view.*` keys are reused unchanged.

## Out of Scope (YAGNI)

- Per-tab mode/view (decided: global).
- Tab renaming / drag-reorder / content-derived labels.
- A hard cap on tab count.
- Generalizing tabs to other tools — this is Diff-only.
- Any change to `diff.ts` transforms or the size-aware pipeline.

## Testing

- **Store** (`store` tests): `addDiffTab` appends + activates + bumps `nextSeq`; `closeDiffTab`
  removes, preserves `length >= 1`, reassigns active to a neighbor; labels stay stable after a
  middle close; `setDiffTabSide` updates only the target tab/side; hydration repair when
  `activeTabId` is stale.
- **`DiffTabs`** smoke: renders tabs, `+` adds, `×` closes, `×` absent with a single tab.
- **`DiffTool`** smoke: split output renders by default; editing flows to the active tab; switching
  tabs swaps editor content and diff output.
- Follow existing Vitest + Testing Library patterns; cover empty/Unicode inputs as the suite does.

## Acceptance Criteria

1. Opening Diff shows the **split** layout by default.
2. A tab strip is visible with at least one tab; `+` opens additional independent comparisons.
3. Each tab keeps its own Original/Changed text; switching tabs swaps both editors and the output.
4. Closing a tab never leaves zero tabs; the close control is hidden when one tab remains.
5. Tab labels do not renumber when an earlier tab is closed.
6. Tabs, active tab, and global mode/view survive an app restart.
7. `npm run lint` and `npm test` pass; `diff.ts` is unchanged.
