import { type ReactNode, useEffect } from "react";
import { useAppStore } from "@/core/store";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };

    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  return <>{children}</>;
}
