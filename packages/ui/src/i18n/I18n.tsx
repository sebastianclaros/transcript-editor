import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Language, type Translator } from "@transcript-editor/core";

interface I18nValue {
  lang: Language;
  t: Translator;
}

const I18nContext = createContext<I18nValue>({ lang: "es", t: createTranslator("es") });

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const value = useMemo(() => ({ lang: language, t: createTranslator(language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  return useContext(I18nContext).t;
}

export function useLanguage(): Language {
  return useContext(I18nContext).lang;
}
