import { create } from "zustand";
import type { LanguagePreference } from "@/core/i18n/types";
import type { DiffMode } from "@/tools/diff/diff";

export type ThemeMode = "system" | "light" | "dark";
export type DiffView = "inline" | "split";

export const DEFAULT_HOTKEY = "Alt+Space";
export const DEFAULT_LANGUAGE: LanguagePreference = "system";

export interface DiffTab {
  id: string;
  seq: number;
  a: string;
  b: string;
  /** User-customized tab name; falls back to the seq-based label when empty. */
  name?: string;
}

export interface DiffSlice {
  tabs: DiffTab[];
  activeTabId: string;
  nextSeq: number;
  mode: DiffMode;
  view: DiffView;
}

type HydrateSlice = Partial<
  Pick<AppState, "favorites" | "theme" | "language" | "activeToolId" | "hotkey">
> & {
  diff?: unknown;
};

function makeBlankTab(seq: number): DiffTab {
  return { id: crypto.randomUUID(), seq, a: "", b: "" };
}

export function makeDefaultDiffSlice(): DiffSlice {
  const tab = makeBlankTab(1);
  return {
    tabs: [tab],
    activeTabId: tab.id,
    nextSeq: 2,
    mode: "line",
    view: "split",
  };
}

function isDiffMode(value: unknown): value is DiffMode {
  return value === "line" || value === "word" || value === "char";
}

function isDiffView(value: unknown): value is DiffView {
  return value === "inline" || value === "split";
}

function isDiffTab(value: unknown): value is DiffTab {
  if (!value || typeof value !== "object") return false;
  const tab = value as Partial<DiffTab>;
  return (
    typeof tab.id === "string" &&
    typeof tab.seq === "number" &&
    typeof tab.a === "string" &&
    typeof tab.b === "string" &&
    (tab.name === undefined || typeof tab.name === "string")
  );
}

function nextSeqFromTabs(tabs: DiffTab[]): number {
  return tabs.reduce((largest, tab) => Math.max(largest, tab.seq), 0) + 1;
}

/**
 * When a close operation leaves a single comparison tab, restart the numbering:
 * the lone tab becomes "Diff 1" and the next added tab is "Diff 2" again. A
 * custom tab name is preserved. Slices with more than one tab pass through.
 */
function resetNumberingWhenSingle(diff: DiffSlice): DiffSlice {
  if (diff.tabs.length !== 1) return diff;
  const only = { ...diff.tabs[0], seq: 1 };
  return { ...diff, tabs: [only], activeTabId: only.id, nextSeq: 2 };
}

function normalizeDiffSlice(value: unknown): DiffSlice {
  if (!value || typeof value !== "object") return makeDefaultDiffSlice();

  const candidate = value as Partial<DiffSlice>;
  const tabs = Array.isArray(candidate.tabs) ? candidate.tabs.filter(isDiffTab) : [];
  if (tabs.length === 0) return makeDefaultDiffSlice();

  const activeTabId =
    typeof candidate.activeTabId === "string" &&
    tabs.some((tab) => tab.id === candidate.activeTabId)
      ? candidate.activeTabId
      : tabs[0].id;
  const minimumNextSeq = nextSeqFromTabs(tabs);
  const nextSeq =
    typeof candidate.nextSeq === "number" && Number.isFinite(candidate.nextSeq)
      ? Math.max(Math.floor(candidate.nextSeq), minimumNextSeq)
      : minimumNextSeq;

  return {
    tabs,
    activeTabId,
    nextSeq,
    mode: isDiffMode(candidate.mode) ? candidate.mode : "line",
    view: isDiffView(candidate.view) ? candidate.view : "split",
  };
}

export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  language: LanguagePreference;
  hotkey: string;
  toolInputs: Record<string, string>;
  diff: DiffSlice;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguagePreference) => void;
  setHotkey: (hotkey: string) => void;
  setToolInput: (id: string, text: string) => void;
  addDiffTab: () => void;
  closeDiffTab: (id: string) => void;
  closeOtherDiffTabs: (id: string) => void;
  closeDiffTabsToRight: (id: string) => void;
  closeAllDiffTabs: () => void;
  setActiveDiffTab: (id: string) => void;
  setDiffTabSide: (id: string, side: "a" | "b", text: string) => void;
  renameDiffTab: (id: string, name: string) => void;
  setDiffMode: (mode: DiffMode) => void;
  setDiffView: (view: DiffView) => void;
  hydrate: (slice: HydrateSlice) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeToolId: null,
  favorites: [],
  theme: "system",
  language: DEFAULT_LANGUAGE,
  hotkey: DEFAULT_HOTKEY,
  toolInputs: {},
  diff: makeDefaultDiffSlice(),
  setActiveTool: (id) => set({ activeToolId: id }),
  toggleFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.includes(id)
        ? state.favorites.filter((favorite) => favorite !== id)
        : [...state.favorites, id],
    })),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setHotkey: (hotkey) => set({ hotkey }),
  setToolInput: (id, text) => set((state) => ({ toolInputs: { ...state.toolInputs, [id]: text } })),
  addDiffTab: () =>
    set((state) => {
      const tab = makeBlankTab(state.diff.nextSeq);
      return {
        diff: {
          ...state.diff,
          tabs: [...state.diff.tabs, tab],
          activeTabId: tab.id,
          nextSeq: state.diff.nextSeq + 1,
        },
      };
    }),
  closeDiffTab: (id) =>
    set((state) => {
      const closingIndex = state.diff.tabs.findIndex((tab) => tab.id === id);
      if (state.diff.tabs.length === 1 || closingIndex === -1) return {};

      const tabs = state.diff.tabs.filter((tab) => tab.id !== id);
      const activeTabId =
        state.diff.activeTabId === id
          ? tabs[Math.max(0, closingIndex - 1)].id
          : state.diff.activeTabId;

      return {
        diff: resetNumberingWhenSingle({ ...state.diff, tabs, activeTabId }),
      };
    }),
  closeOtherDiffTabs: (id) =>
    set((state) => {
      const kept = state.diff.tabs.find((tab) => tab.id === id);
      if (!kept || state.diff.tabs.length === 1) return {};
      return {
        diff: resetNumberingWhenSingle({
          ...state.diff,
          tabs: [kept],
          activeTabId: kept.id,
        }),
      };
    }),
  closeDiffTabsToRight: (id) =>
    set((state) => {
      const index = state.diff.tabs.findIndex((tab) => tab.id === id);
      if (index === -1 || index === state.diff.tabs.length - 1) return {};
      const tabs = state.diff.tabs.slice(0, index + 1);
      const activeTabId = tabs.some((tab) => tab.id === state.diff.activeTabId)
        ? state.diff.activeTabId
        : id;
      return {
        diff: resetNumberingWhenSingle({ ...state.diff, tabs, activeTabId }),
      };
    }),
  closeAllDiffTabs: () =>
    set((state) => {
      const tab = makeBlankTab(1);
      return {
        diff: {
          ...state.diff,
          tabs: [tab],
          activeTabId: tab.id,
          nextSeq: 2,
        },
      };
    }),
  setActiveDiffTab: (id) =>
    set((state) =>
      state.diff.tabs.some((tab) => tab.id === id)
        ? { diff: { ...state.diff, activeTabId: id } }
        : {},
    ),
  setDiffTabSide: (id, side, text) =>
    set((state) =>
      state.diff.tabs.some((tab) => tab.id === id)
        ? {
            diff: {
              ...state.diff,
              tabs: state.diff.tabs.map((tab) => (tab.id === id ? { ...tab, [side]: text } : tab)),
            },
          }
        : {},
    ),
  renameDiffTab: (id, name) =>
    set((state) => {
      if (!state.diff.tabs.some((tab) => tab.id === id)) return {};
      const trimmed = name.trim();
      return {
        diff: {
          ...state.diff,
          tabs: state.diff.tabs.map((tab) =>
            tab.id === id ? { ...tab, name: trimmed === "" ? undefined : trimmed } : tab,
          ),
        },
      };
    }),
  setDiffMode: (mode) => set((state) => ({ diff: { ...state.diff, mode } })),
  setDiffView: (view) => set((state) => ({ diff: { ...state.diff, view } })),
  hydrate: (slice) => {
    const { diff, ...rest } = slice;
    set({
      ...rest,
      ...(diff === undefined ? {} : { diff: normalizeDiffSlice(diff) }),
    });
  },
}));
