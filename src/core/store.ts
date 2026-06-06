import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

export const DEFAULT_HOTKEY = "Alt+Space";

export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  hotkey: string;
  toolInputs: Record<string, string>;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setHotkey: (hotkey: string) => void;
  setToolInput: (id: string, text: string) => void;
  hydrate: (
    slice: Partial<Pick<AppState, "favorites" | "theme" | "activeToolId" | "hotkey">>,
  ) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeToolId: null,
  favorites: [],
  theme: "system",
  hotkey: DEFAULT_HOTKEY,
  toolInputs: {},
  setActiveTool: (id) => set({ activeToolId: id }),
  toggleFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.includes(id)
        ? state.favorites.filter((favorite) => favorite !== id)
        : [...state.favorites, id],
    })),
  setTheme: (theme) => set({ theme }),
  setHotkey: (hotkey) => set({ hotkey }),
  setToolInput: (id, text) => set((state) => ({ toolInputs: { ...state.toolInputs, [id]: text } })),
  hydrate: (slice) => set(slice),
}));
