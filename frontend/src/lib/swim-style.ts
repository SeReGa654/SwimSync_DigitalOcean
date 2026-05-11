export type SwimStyleCode = 'FREE' | 'BREAST' | 'BACK' | 'FLY' | 'MEDLEY';

const STYLE_UA_BY_CODE: Record<SwimStyleCode, string> = {
  FREE: 'Вільний стиль',
  BREAST: 'Брас',
  BACK: 'На спині',
  FLY: 'Батерфляй',
  MEDLEY: 'Комплексне плавання',
};

const STYLE_SHORT_UA_BY_CODE: Record<SwimStyleCode, string> = {
  FREE: 'в/с',
  BREAST: 'брас',
  BACK: 'н/с',
  FLY: 'бат',
  MEDLEY: 'к/п',
};

const STYLE_CODE_ALIASES: Record<string, SwimStyleCode> = {
  FREE: 'FREE',
  FREESTYLE: 'FREE',
  BREAST: 'BREAST',
  BREASTSTROKE: 'BREAST',
  BACK: 'BACK',
  BACKSTROKE: 'BACK',
  FLY: 'FLY',
  BUTTERFLY: 'FLY',
  MEDLEY: 'MEDLEY',
};

const STYLE_TEXT_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bFreestyle\b/gi, replacement: STYLE_UA_BY_CODE.FREE },
  { pattern: /\bFREE\b/g, replacement: STYLE_UA_BY_CODE.FREE },
  { pattern: /\bBreaststroke\b/gi, replacement: STYLE_UA_BY_CODE.BREAST },
  { pattern: /\bBREAST\b/g, replacement: STYLE_UA_BY_CODE.BREAST },
  { pattern: /\bBackstroke\b/gi, replacement: STYLE_UA_BY_CODE.BACK },
  { pattern: /\bBACK\b/g, replacement: STYLE_UA_BY_CODE.BACK },
  { pattern: /\bButterfly\b/gi, replacement: STYLE_UA_BY_CODE.FLY },
  { pattern: /\bFLY\b/g, replacement: STYLE_UA_BY_CODE.FLY },
  { pattern: /\bMedley\b/gi, replacement: STYLE_UA_BY_CODE.MEDLEY },
  { pattern: /\bMEDLEY\b/g, replacement: STYLE_UA_BY_CODE.MEDLEY },
];

function normalizeStyleCode(style: string): SwimStyleCode | undefined {
  return STYLE_CODE_ALIASES[style.trim().toUpperCase()];
}

export function toStyleUa(style: string): string {
  const normalized = normalizeStyleCode(style);
  if (!normalized) return style;
  return STYLE_UA_BY_CODE[normalized];
}

export function toStyleShortUa(style: string): string {
  const normalized = normalizeStyleCode(style);
  if (!normalized) return style;
  return STYLE_SHORT_UA_BY_CODE[normalized];
}

export function localizeEventName(name: string): string {
  return STYLE_TEXT_REPLACEMENTS.reduce(
    (result, rule) => result.replace(rule.pattern, rule.replacement),
    name,
  );
}
