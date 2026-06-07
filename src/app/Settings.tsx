import { invoke } from "@tauri-apps/api/core";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { type I18nKey, type LanguagePreference, useI18n } from "@/core/i18n";
import { type ThemeMode, useAppStore } from "@/core/store";

const THEMES: ThemeMode[] = ["system", "light", "dark"];
const LANGUAGES: LanguagePreference[] = ["system", "en", "zh-CN"];
const LANGUAGE_LABELS: Record<LanguagePreference, string> = {
  system: "System",
  en: "English",
  "zh-CN": "Simplified Chinese",
};
const THEME_LABEL_KEYS: Record<ThemeMode, I18nKey> = {
  system: "app.settings.theme.system",
  light: "app.settings.theme.light",
  dark: "app.settings.theme.dark",
};

type Status = { key: I18nKey } | { text: string };

export function Settings({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const hotkey = useAppStore((state) => state.hotkey);
  const setHotkey = useAppStore((state) => state.setHotkey);
  const [draft, setDraft] = useState(hotkey);
  const [status, setStatus] = useState<Status | null>(null);

  async function applyHotkey() {
    try {
      await invoke("set_hotkey", { accelerator: draft });
      setHotkey(draft);
      setStatus({ key: "app.settings.saved" });
    } catch (error) {
      setStatus(
        error instanceof Error ? { text: error.message } : { key: "app.settings.hotkeyError" },
      );
    }
  }

  return (
    <main className="flex h-full flex-1 flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-medium">{t("app.settings.title")}</h1>
        <button
          type="button"
          aria-label={t("app.settings.close")}
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex max-w-2xl flex-col gap-8 p-6">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">{t("app.settings.appearance")}</h2>
            <p className="text-xs text-muted-foreground">{t("app.settings.theme")}</p>
          </div>
          <fieldset
            aria-label={t("app.settings.theme")}
            className="inline-flex w-fit rounded-md border border-border p-1"
          >
            {THEMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={`rounded px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  theme === item
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t(THEME_LABEL_KEYS[item])}
              </button>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">Language</p>
          <fieldset
            aria-label="Language"
            className="inline-flex w-fit rounded-md border border-border p-1"
          >
            {LANGUAGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                className={`rounded px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  language === item
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {LANGUAGE_LABELS[item]}
              </button>
            ))}
          </fieldset>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">{t("app.settings.globalHotkey")}</h2>
            <p className="text-xs text-muted-foreground">{t("app.settings.windowToggle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={t("app.settings.hotkey")}
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
              {t("app.settings.apply")}
            </button>
            {status && (
              <span className="text-xs text-muted-foreground">
                {"key" in status ? t(status.key) : status.text}
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
