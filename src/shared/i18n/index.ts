import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enUS from "./locales/en-US/common.json";
import ptBR from "./locales/pt-BR/common.json";

export const DEFAULT_LOCALE = "pt-BR";
export const SUPPORTED_LOCALES = ["pt-BR", "en-US"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { common: ptBR },
      "en-US": { common: enUS },
    },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
  });

/**
 * Cada módulo tem seu namespace (ex.: "pessoas") e registra as próprias traduções:
 *
 *   registerModuleLocales("pessoas", { "pt-BR": ptBR, "en-US": enUS });
 *
 * Nos componentes: `const { t } = useTranslation("pessoas")`.
 */
export function registerModuleLocales(namespace: string, resources: Record<Locale, object>): void {
  for (const locale of SUPPORTED_LOCALES) {
    i18n.addResourceBundle(locale, namespace, resources[locale], true, true);
  }
}

export default i18n;
