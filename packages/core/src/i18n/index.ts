import { en } from "./en";
import { es } from "./es";

export type Language = "es" | "en";
export type MessageKey = keyof typeof es;
export const LANGUAGES: readonly Language[] = ["es", "en"];
export const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { es, en };

export type Params = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: Params) => string;

/** Replaces `{name}` placeholders; a missing param leaves the placeholder visible. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

export function createTranslator(lang: Language): Translator {
  const dict = DICTIONARIES[lang] ?? es;
  return (key, params) => interpolate(dict[key] ?? es[key] ?? key, params);
}

/** Plural helper using paired keys `foo_one` / `foo_other`. */
export function createPluralTranslator(lang: Language) {
  const t = createTranslator(lang);
  const rules = new Intl.PluralRules(lang);
  return (base: string, count: number, params?: Params): string => {
    const suffix = rules.select(count) === "one" ? "_one" : "_other";
    return t((base + suffix) as MessageKey, { count, ...params });
  };
}

export function isLanguage(v: unknown): v is Language {
  return v === "es" || v === "en";
}

/** Picks the UI language from a system locale (`es-AR` -> es); Spanish is the default. */
export function languageFromLocale(locale: string | undefined): Language {
  return locale && /^en\b/i.test(locale) ? "en" : "es";
}

export { es, en };
