// src/domain/value-objects/LocalizedString.ts
export interface LocalizedString {
  en: string;
  fi?: string;
  sv?: string;
}

export function getLocalizedString(value: LocalizedString, lang: keyof LocalizedString = 'en') {
  return value[lang] ?? value.en;
}