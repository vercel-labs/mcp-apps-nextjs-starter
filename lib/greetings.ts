/**
 * Example domain logic shared by the MCP tools (server) and the widget (client).
 * Replace this with your own data layer.
 */

export const LANGUAGES = {
  en: { label: "English", hello: "Hello" },
  es: { label: "Español", hello: "¡Hola" },
  fr: { label: "Français", hello: "Bonjour" },
  ja: { label: "日本語", hello: "こんにちは" },
} as const;

export type Language = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as [Language, ...Language[]];

export interface Greeting {
  [key: string]: unknown;
  name: string;
  language: Language;
  greeting: string;
}

export function greet(name: string, language: Language = "en"): Greeting {
  const trimmed = name.trim();
  const { hello } = LANGUAGES[language];
  const greeting = language === "ja" ? `${trimmed}さん、${hello}！` : `${hello}, ${trimmed}!`;
  return { name: trimmed, language, greeting };
}

export function isGreeting(value: unknown): value is Greeting {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.greeting === "string" &&
    typeof v.language === "string" &&
    v.language in LANGUAGES
  );
}
