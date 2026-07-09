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
import { type TextTabToolId, type ThemeMode, useAppStore } from "@/core/store";

function isTextTabToolId(toolId: string): toolId is TextTabToolId {
  return toolId === "json" || toolId === "xml";
}

function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const activeToolId = useAppStore((state) => state.activeToolId);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setToolInput = useAppStore((state) => state.setToolInput);
  const setTextTabInput = useAppStore((state) => state.setTextTabInput);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { text: clipText, suggestedToolId, clear: clearClip } = useClipboardDetect();
  const suggestedTool = getTool(suggestedToolId);

  const selectTool = (toolId: string) => {
    setActiveTool(toolId);
    setSettingsOpen(false);
  };

  const fillToolInput = (toolId: string, text: string) => {
    if (isTextTabToolId(toolId)) {
      const { activeTabId } = useAppStore.getState().textTabs[toolId];
      setTextTabInput(toolId, activeTabId, text);
      return;
    }
    setToolInput(toolId, text);
  };

  useEffect(() => {
    Promise.all([
      storage().get<string[]>("favorites"),
      storage().get<ThemeMode>("theme"),
      storage().get<LanguagePreference>("language"),
      storage().get<string>("hotkey"),
      storage().get<unknown>("diff"),
      storage().get<unknown>("textTabs"),
      storage().get<boolean>("wrap"),
      storage().get<unknown>("translate"),
    ]).then(([favorites, theme, language, hotkey, diff, textTabs, wrap, translate]) => {
      hydrate({
        ...(favorites ? { favorites } : {}),
        ...(theme ? { theme } : {}),
        ...(language ? { language } : {}),
        ...(hotkey ? { hotkey } : {}),
        ...(diff ? { diff } : {}),
        ...(textTabs ? { textTabs } : {}),
        ...(typeof wrap === "boolean" ? { wrap } : {}),
        ...(translate ? { translate } : {}),
      });
      if (hotkey) {
        void invoke("set_hotkey", { accelerator: hotkey }).catch(() => {});
      }
      setReady(true);
    });
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.favorites !== prev.favorites) void storage().set("favorites", state.favorites);
      if (state.theme !== prev.theme) void storage().set("theme", state.theme);
      if (state.language !== prev.language) void storage().set("language", state.language);
      if (state.hotkey !== prev.hotkey) void storage().set("hotkey", state.hotkey);
      if (state.diff !== prev.diff) void storage().set("diff", state.diff);
      if (state.textTabs !== prev.textTabs) void storage().set("textTabs", state.textTabs);
      if (state.wrap !== prev.wrap) void storage().set("wrap", state.wrap);
      if (state.translate !== prev.translate) void storage().set("translate", state.translate);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (event.key === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
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
          <Sidebar
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            onSelectTool={selectTool}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            {clipText && (
              <ClipboardBanner
                text={clipText}
                suggestionNameKey={suggestedTool?.nameKey}
                onFill={(text) => {
                  if (activeToolId) fillToolInput(activeToolId, text);
                  clearClip();
                }}
                onOpenSuggestion={() => {
                  if (suggestedToolId) {
                    selectTool(suggestedToolId);
                    fillToolInput(suggestedToolId, clipText);
                  }
                  clearClip();
                }}
                onDismiss={clearClip}
              />
            )}
            {settingsOpen ? <Settings onClose={() => setSettingsOpen(false)} /> : <DetailHost />}
          </div>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            onSelectTool={selectTool}
          />
        </div>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
