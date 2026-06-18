import { create } from "zustand";
import type { LanguagePreference } from "@/core/i18n/types";
import type { DiffMode } from "@/tools/diff/diff";
import {
  AUTO,
  DEEPSEEK_ENDPOINT,
  DEEPSEEK_MODELS,
  DEFAULT_OPENAI_MODEL,
  LANGUAGES,
  OPENAI_ENDPOINT,
  type ProviderConfig,
  type ProviderId,
  STYLE_IDS,
  type StyleId,
} from "@/tools/translate/translate";

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

export interface TranslateSlice {
  /** Language id or AUTO. */
  source: string;
  /** Language id (never AUTO). */
  target: string;
  style: StyleId;
  provider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
}

type HydrateSlice = Partial<
  Pick<AppState, "favorites" | "theme" | "language" | "activeToolId" | "hotkey" | "wrap">
> & {
  diff?: unknown;
  translate?: unknown;
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

export function makeDefaultTranslateSlice(): TranslateSlice {
  return {
    source: AUTO,
    target: "en",
    style: "general",
    provider: "deepseek",
    providers: {
      deepseek: {
        apiKey: "",
        model: DEEPSEEK_MODELS[0],
        endpointUrl: DEEPSEEK_ENDPOINT,
      },
      openai: {
        apiKey: "",
        model: DEFAULT_OPENAI_MODEL,
        endpointUrl: OPENAI_ENDPOINT,
      },
      custom: { apiKey: "", model: "", endpointUrl: "" },
    },
  };
}

function isStyleId(value: unknown): value is StyleId {
  return typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "deepseek" || value === "openai" || value === "custom";
}

function isLanguageId(value: unknown): value is string {
  return typeof value === "string" && LANGUAGES.some((language) => language.id === value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Preset endpoints always reset to their fixed URLs; the DeepSeek model must
 * be in its enum; a blank OpenAI model falls back to the default. Custom
 * key/model/endpoint pass through as-is (a blank Custom model is preserved —
 * it blocks sending with a setup hint instead).
 */
export function normalizeTranslateSlice(value: unknown): TranslateSlice {
  const defaults = makeDefaultTranslateSlice();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<Omit<TranslateSlice, "providers">> & {
    providers?: Partial<Record<ProviderId, Partial<ProviderConfig>>>;
  };
  const deepseek = candidate.providers?.deepseek ?? {};
  const openai = candidate.providers?.openai ?? {};
  const custom = candidate.providers?.custom ?? {};

  return {
    source: candidate.source === AUTO || isLanguageId(candidate.source) ? candidate.source : AUTO,
    target: isLanguageId(candidate.target) ? candidate.target : defaults.target,
    style: isStyleId(candidate.style) ? candidate.style : defaults.style,
    provider: isProviderId(candidate.provider) ? candidate.provider : defaults.provider,
    providers: {
      deepseek: {
        apiKey: asString(deepseek.apiKey, ""),
        model: (DEEPSEEK_MODELS as readonly string[]).includes(deepseek.model as string)
          ? (deepseek.model as string)
          : DEEPSEEK_MODELS[0],
        endpointUrl: DEEPSEEK_ENDPOINT,
      },
      openai: {
        apiKey: asString(openai.apiKey, ""),
        model:
          typeof openai.model === "string" && openai.model.trim() !== ""
            ? openai.model
            : DEFAULT_OPENAI_MODEL,
        endpointUrl: OPENAI_ENDPOINT,
      },
      custom: {
        apiKey: asString(custom.apiKey, ""),
        model: asString(custom.model, ""),
        endpointUrl: asString(custom.endpointUrl, ""),
      },
    },
  };
}

export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  language: LanguagePreference;
  hotkey: string;
  /** Word-wrap output panes (JSON/XML/Diff). Shared across those tools. */
  wrap: boolean;
  toolInputs: Record<string, string>;
  diff: DiffSlice;
  translate: TranslateSlice;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  /** Move `sourceId` next to `targetId` within the favorites order. */
  reorderFavorites: (sourceId: string, targetId: string, placeAfter: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguagePreference) => void;
  setHotkey: (hotkey: string) => void;
  setWrap: (wrap: boolean) => void;
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
  setTranslateLanguages: (source: string, target: string) => void;
  setTranslateStyle: (style: StyleId) => void;
  setTranslateProvider: (provider: ProviderId) => void;
  setTranslateProviderConfig: (id: ProviderId, patch: Partial<ProviderConfig>) => void;
  hydrate: (slice: HydrateSlice) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeToolId: null,
  favorites: [],
  theme: "system",
  language: DEFAULT_LANGUAGE,
  hotkey: DEFAULT_HOTKEY,
  wrap: true,
  toolInputs: {},
  diff: makeDefaultDiffSlice(),
  translate: makeDefaultTranslateSlice(),
  setActiveTool: (id) => set({ activeToolId: id }),
  toggleFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.includes(id)
        ? state.favorites.filter((favorite) => favorite !== id)
        : [...state.favorites, id],
    })),
  reorderFavorites: (sourceId, targetId, placeAfter) =>
    set((state) => {
      const { favorites } = state;
      if (sourceId === targetId) return {};
      if (!favorites.includes(sourceId) || !favorites.includes(targetId)) return {};
      const without = favorites.filter((id) => id !== sourceId);
      const insertAt = without.indexOf(targetId) + (placeAfter ? 1 : 0);
      const next = [...without.slice(0, insertAt), sourceId, ...without.slice(insertAt)];
      return next.every((id, index) => id === favorites[index]) ? {} : { favorites: next };
    }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setHotkey: (hotkey) => set({ hotkey }),
  setWrap: (wrap) => set({ wrap }),
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
  setTranslateLanguages: (source, target) =>
    set((state) => ({ translate: { ...state.translate, source, target } })),
  setTranslateStyle: (style) => set((state) => ({ translate: { ...state.translate, style } })),
  setTranslateProvider: (provider) =>
    set((state) => ({ translate: { ...state.translate, provider } })),
  setTranslateProviderConfig: (id, patch) =>
    set((state) => ({
      translate: {
        ...state.translate,
        providers: {
          ...state.translate.providers,
          [id]: { ...state.translate.providers[id], ...patch },
        },
      },
    })),
  hydrate: (slice) => {
    const { diff, translate, ...rest } = slice;
    set({
      ...rest,
      ...(diff === undefined ? {} : { diff: normalizeDiffSlice(diff) }),
      ...(translate === undefined ? {} : { translate: normalizeTranslateSlice(translate) }),
    });
  },
}));
