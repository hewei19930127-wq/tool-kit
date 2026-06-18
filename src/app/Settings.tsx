import { invoke } from "@tauri-apps/api/core";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { type I18nKey, type LanguagePreference, useI18n } from "@/core/i18n";
import { type ThemeMode, useAppStore } from "@/core/store";
import { DEEPSEEK_MODELS, PROVIDER_IDS, type ProviderId } from "@/tools/translate/translate";

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
  const translate = useAppStore((state) => state.translate);
  const setTranslateProvider = useAppStore((state) => state.setTranslateProvider);
  const setTranslateProviderConfig = useAppStore((state) => state.setTranslateProviderConfig);
  const [keyVisible, setKeyVisible] = useState(false);
  const providerConfig = translate.providers[translate.provider];
  const providerLabel = (id: ProviderId) =>
    id === "deepseek"
      ? "DeepSeek"
      : id === "openai"
        ? "OpenAI"
        : t("app.settings.translation.providerCustom");

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
      <header
        data-tauri-drag-region="deep"
        className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4"
      >
        <h1 className="text-sm font-semibold tracking-tight">{t("app.settings.title")}</h1>
        <button
          type="button"
          aria-label={t("app.settings.close")}
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex max-w-2xl flex-col gap-5 overflow-y-auto p-6">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold">{t("app.settings.appearance")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("app.settings.theme")}</p>
          </div>
          <fieldset
            aria-label={t("app.settings.theme")}
            className="inline-flex w-fit rounded-lg bg-muted p-1"
          >
            {THEMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={`rounded-md px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                  theme === item
                    ? "bg-surface font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(THEME_LABEL_KEYS[item])}
              </button>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">Language</p>
          <fieldset aria-label="Language" className="inline-flex w-fit rounded-lg bg-muted p-1">
            {LANGUAGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                className={`rounded-md px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                  language === item
                    ? "bg-surface font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {LANGUAGE_LABELS[item]}
              </button>
            ))}
          </fieldset>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold">{t("app.settings.translation")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("app.settings.translation.plaintextNote")}
            </p>
          </div>
          <fieldset
            aria-label={t("app.settings.translation.provider")}
            className="inline-flex w-fit rounded-lg bg-muted p-1"
          >
            {PROVIDER_IDS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTranslateProvider(item);
                  setKeyVisible(false);
                }}
                className={`rounded-md px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                  translate.provider === item
                    ? "bg-surface font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {providerLabel(item)}
              </button>
            ))}
          </fieldset>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("app.settings.translation.apiKey")}
              <div className="flex items-center gap-2">
                <input
                  aria-label={t("app.settings.translation.apiKey")}
                  type={keyVisible ? "text" : "password"}
                  autoComplete="off"
                  value={providerConfig.apiKey}
                  onChange={(event) =>
                    setTranslateProviderConfig(translate.provider, {
                      apiKey: event.target.value,
                    })
                  }
                  className="w-72 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  aria-label={t(
                    keyVisible
                      ? "app.settings.translation.hideKey"
                      : "app.settings.translation.showKey",
                  )}
                  onClick={() => setKeyVisible((visible) => !visible)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {keyVisible ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("app.settings.translation.model")}
              {translate.provider === "deepseek" ? (
                <select
                  aria-label={t("app.settings.translation.model")}
                  value={providerConfig.model}
                  onChange={(event) =>
                    setTranslateProviderConfig("deepseek", {
                      model: event.target.value,
                    })
                  }
                  className="w-72 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {DEEPSEEK_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={t("app.settings.translation.model")}
                  value={providerConfig.model}
                  onChange={(event) =>
                    setTranslateProviderConfig(translate.provider, {
                      model: event.target.value,
                    })
                  }
                  placeholder={translate.provider === "openai" ? "gpt-5.2" : "llama3.3"}
                  className="w-72 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              )}
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("app.settings.translation.endpoint")}
              {translate.provider === "custom" ? (
                <input
                  aria-label={t("app.settings.translation.endpoint")}
                  value={providerConfig.endpointUrl}
                  onChange={(event) =>
                    setTranslateProviderConfig("custom", {
                      endpointUrl: event.target.value,
                    })
                  }
                  placeholder="http://localhost:11434/v1/chat/completions"
                  className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              ) : (
                <span className="font-mono text-sm text-foreground">
                  {providerConfig.endpointUrl}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold">{t("app.settings.globalHotkey")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("app.settings.windowToggle")}</p>
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
              className="w-72 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <button
              type="button"
              onClick={applyHotkey}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
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
