import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { ClipboardBanner } from "@/app/ClipboardBanner";
import { CommandPalette } from "@/app/CommandPalette";
import { DetailHost } from "@/app/DetailHost";
import { LanguageProvider } from "@/app/LanguageProvider";
import { Settings } from "@/app/Settings";
import { Sidebar } from "@/app/Sidebar";
import { ThemeProvider } from "@/app/ThemeProvider";
import { useClipboardDetect } from "@/core/hooks/useClipboardDetect";
import type { LanguagePreference } from "@/core/i18n";
import { getTool } from "@/core/registry";
import { storage } from "@/core/services/storage";
import { type ThemeMode, useAppStore } from "@/core/store";

function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const activeToolId = useAppStore((state) => state.activeToolId);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setToolInput = useAppStore((state) => state.setToolInput);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { text: clipText, suggestedToolId, clear: clearClip } = useClipboardDetect();
  const suggestedTool = getTool(suggestedToolId);

  const selectTool = (toolId: string) => {
    setActiveTool(toolId);
    setSettingsOpen(false);
  };

  useEffect(() => {
    Promise.all([
      storage().get<string[]>("favorites"),
      storage().get<ThemeMode>("theme"),
      storage().get<LanguagePreference>("language"),
      storage().get<string>("hotkey"),
    ]).then(([favorites, theme, language, hotkey]) => {
      hydrate({
        ...(favorites ? { favorites } : {}),
        ...(theme ? { theme } : {}),
        ...(language ? { language } : {}),
        ...(hotkey ? { hotkey } : {}),
      });
      if (hotkey) {
        void invoke("set_hotkey", { accelerator: hotkey }).catch(() => {});
      }
      setReady(true);
    });
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state) => {
      void storage().set("favorites", state.favorites);
      void storage().set("theme", state.theme);
      void storage().set("language", state.language);
      void storage().set("hotkey", state.hotkey);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <LanguageProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
          <Sidebar onOpenSettings={() => setSettingsOpen(true)} onSelectTool={selectTool} />
          <div className="flex min-w-0 flex-1 flex-col">
            {clipText && (
              <ClipboardBanner
                text={clipText}
                suggestionNameKey={suggestedTool?.nameKey}
                onFill={(text) => {
                  if (activeToolId) setToolInput(activeToolId, text);
                  clearClip();
                }}
                onOpenSuggestion={() => {
                  if (suggestedToolId) {
                    selectTool(suggestedToolId);
                    setToolInput(suggestedToolId, clipText);
                  }
                  clearClip();
                }}
                onDismiss={clearClip}
              />
            )}
            {settingsOpen ? <Settings onClose={() => setSettingsOpen(false)} /> : <DetailHost />}
          </div>
          <CommandPalette onSelectTool={selectTool} />
        </div>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
