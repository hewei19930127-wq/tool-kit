import { invoke } from "@tauri-apps/api/core";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { type ThemeMode, useAppStore } from "@/core/store";

const THEMES: ThemeMode[] = ["system", "light", "dark"];

export function Settings({ onClose }: { onClose: () => void }) {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const hotkey = useAppStore((state) => state.hotkey);
  const setHotkey = useAppStore((state) => state.setHotkey);
  const [draft, setDraft] = useState(hotkey);
  const [status, setStatus] = useState<string | null>(null);

  async function applyHotkey() {
    try {
      await invoke("set_hotkey", { accelerator: draft });
      setHotkey(draft);
      setStatus("Saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not register shortcut");
    }
  }

  return (
    <main className="flex h-full flex-1 flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-medium">Settings</h1>
        <button
          type="button"
          aria-label="Close settings"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex max-w-2xl flex-col gap-8 p-6">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">Appearance</h2>
            <p className="text-xs text-muted-foreground">Theme</p>
          </div>
          <fieldset
            aria-label="Theme"
            className="inline-flex w-fit rounded-md border border-border p-1"
          >
            {THEMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={`rounded px-3 py-1.5 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  theme === item
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </fieldset>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">Global hotkey</h2>
            <p className="text-xs text-muted-foreground">Window toggle</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Hotkey"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setStatus(null);
              }}
              placeholder="Alt+Space"
              className="w-72 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={applyHotkey}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Check className="h-4 w-4" strokeWidth={1.75} />
              Apply
            </button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
