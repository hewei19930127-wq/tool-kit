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

export function makeDefaultDiffSlice(): DiffSlice {
  const id = crypto.randomUUID();
  return {
    tabs: [{ id, seq: 1, a: "", b: "" }],
    activeTabId: id,
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
    typeof tab.b === "string"
  );
}

function nextSeqFromTabs(tabs: DiffTab[]): number {
  return tabs.reduce((largest, tab) => Math.max(largest, tab.seq), 0) + 1;
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
  setActiveDiffTab: (id: string) => void;
  setDiffTabSide: (id: string, side: "a" | "b", text: string) => void;
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
      const id = crypto.randomUUID();
      const tab = { id, seq: state.diff.nextSeq, a: "", b: "" };
      return {
        diff: {
          ...state.diff,
          tabs: [...state.diff.tabs, tab],
          activeTabId: id,
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

      return { diff: { ...state.diff, tabs, activeTabId } };
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
