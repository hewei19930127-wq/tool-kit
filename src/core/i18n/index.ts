import { useMemo } from "react";
import { useAppStore } from "@/core/store";
import { en } from "./messages/en";
import { zhCN } from "./messages/zh-CN";
import type { I18nKey, I18nParams, LanguagePreference, Locale, TFunction } from "./types";

export type { I18nKey, I18nParams, LanguagePreference, Locale, TFunction };

const messages: Record<Locale, Record<I18nKey, string>> = {
  en,
  "zh-CN": zhCN,
};

function normalizeLanguage(language: string): Locale | null {
  const normalized = language.toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-hans" ||
    normalized === "zh-sg" ||
    normalized.startsWith("zh-hans-")
  ) {
    return "zh-CN";
  }
  return null;
}

export function resolveLanguage(
  preference: LanguagePreference,
  languages: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages,
): Locale {
  if (preference !== "system") return preference;

  for (const language of languages) {
    const locale = normalizeLanguage(language);
    if (locale) return locale;
  }

  if (typeof navigator !== "undefined") {
    const locale = normalizeLanguage(navigator.language);
    if (locale) return locale;
  }

  return "en";
}

const objectHasOwnProperty = Object.prototype.hasOwnProperty;

function interpolate(message: string, params?: I18nParams): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) =>
    objectHasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}

const warnedKeys = new Set<string>();

export function createTranslator(locale: Locale): TFunction {
  return (key, params) => {
    const template = messages[locale][key] ?? en[key];
    if (!template) {
      if (import.meta.env.DEV && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        console.warn(`Missing i18n key: ${key}`);
      }
      return key;
    }
    return interpolate(template, params);
  };
}

export function useI18n(): { language: LanguagePreference; locale: Locale; t: TFunction } {
  const language = useAppStore((state) => state.language);
  const locale = resolveLanguage(language);
  const t = useMemo(() => createTranslator(locale), [locale]);
  return { language, locale, t };
}
