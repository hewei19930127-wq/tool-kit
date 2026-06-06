import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

export interface AppState {
  activeToolId: string | null;
  favorites: string[];
  theme: ThemeMode;
  setActiveTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  hydrate: (
    slice: Partial<Pick<AppState, "favorites" | "theme" | "activeToolId">>,
  ) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeToolId: null,
  favorites: [],
  theme: "system",
  setActiveTool: (id) => set({ activeToolId: id }),
  toggleFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.includes(id)
        ? state.favorites.filter((favorite) => favorite !== id)
        : [...state.favorites, id],
    })),
  setTheme: (theme) => set({ theme }),
  hydrate: (slice) => set(slice),
}));
