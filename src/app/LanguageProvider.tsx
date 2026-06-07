import { type ReactNode, useEffect } from "react";
import { useI18n } from "@/core/i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}
