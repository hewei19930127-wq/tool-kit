import { useEffect, useState } from "react";
import { ClipboardBanner } from "@/app/ClipboardBanner";
import { CommandPalette } from "@/app/CommandPalette";
import { DetailHost } from "@/app/DetailHost";
import { Sidebar } from "@/app/Sidebar";
import { ThemeProvider } from "@/app/ThemeProvider";
import { useClipboardDetect } from "@/core/hooks/useClipboardDetect";
import { getTool } from "@/core/registry";
import { storage } from "@/core/services/storage";
import { useAppStore, type ThemeMode } from "@/core/store";

function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const activeToolId = useAppStore((state) => state.activeToolId);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setToolInput = useAppStore((state) => state.setToolInput);
  const [ready, setReady] = useState(false);
  const {
    text: clipText,
    suggestedToolId,
    clear: clearClip,
  } = useClipboardDetect();
  const suggestionName = getTool(suggestedToolId)?.name;

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

  if (!ready) return null;

  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {clipText && (
            <ClipboardBanner
              text={clipText}
              suggestionName={suggestionName}
              onFill={(text) => {
                if (activeToolId) setToolInput(activeToolId, text);
                clearClip();
              }}
              onOpenSuggestion={() => {
                if (suggestedToolId) {
                  setActiveTool(suggestedToolId);
                  setToolInput(suggestedToolId, clipText);
                }
                clearClip();
              }}
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
