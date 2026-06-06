import { useEffect, useState } from "react";
import { ClipboardBanner } from "@/app/ClipboardBanner";
import { CommandPalette } from "@/app/CommandPalette";
import { DetailHost } from "@/app/DetailHost";
import { Sidebar } from "@/app/Sidebar";
import { ThemeProvider } from "@/app/ThemeProvider";
import { useClipboardDetect } from "@/core/hooks/useClipboardDetect";
import { storage } from "@/core/services/storage";
import { useAppStore, type ThemeMode } from "@/core/store";

function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const [ready, setReady] = useState(false);
  const { text: clipText, clear: clearClip } = useClipboardDetect();

  useEffect(() => {
    Promise.all([
      storage().get<string[]>("favorites"),
      storage().get<ThemeMode>("theme"),
    ]).then(([favorites, theme]) => {
      hydrate({
        ...(favorites ? { favorites } : {}),
        ...(theme ? { theme } : {}),
      });
      setReady(true);
    });
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state) => {
      void storage().set("favorites", state.favorites);
      void storage().set("theme", state.theme);
    });
    return unsubscribe;
  }, []);

  const fillActiveInput = (text: string) => {
    window.dispatchEvent(
      new CustomEvent("toolkit:fill-active-input", { detail: text }),
    );
    clearClip();
  };

  if (!ready) return null;

  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {clipText && (
            <ClipboardBanner
              text={clipText}
              onFill={fillActiveInput}
              onDismiss={clearClip}
            />
          )}
          <DetailHost />
        </div>
        <CommandPalette />
      </div>
    </ThemeProvider>
  );
}

export default App;
