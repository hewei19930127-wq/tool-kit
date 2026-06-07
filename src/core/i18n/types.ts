import type { en } from "./messages/en";

export type I18nKey = keyof typeof en;
export type Locale = "en" | "zh-CN";
export type LanguagePreference = "system" | Locale;
export type I18nParamValue = string | number;
export type I18nParams = Record<string, I18nParamValue>;
export type TFunction = (key: I18nKey, params?: I18nParams) => string;
