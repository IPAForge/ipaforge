const SUBTAG_SEPARATOR = "-";

/** `Intl`'s canonical spelling ("pt-br" → "pt-BR"), or undefined for a malformed tag. */
const canonical = (tag: string): string | undefined => {
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
};

/** "zh-Hant-HK" → ["zh-Hant-HK", "zh-Hant", "zh"]: the tag, then ever shorter prefixes (RFC 4647 lookup). */
const fallbackChain = (tag: string): string[] => {
  const subtags = tag.split(SUBTAG_SEPARATOR);
  return subtags.map((_, index) => subtags.slice(0, subtags.length - index).join(SUBTAG_SEPARATOR));
};

/**
 * Picks the supported locale that best serves the user's preferred languages, in preference order:
 * for each preferred tag, an exact match, then the same language with fewer subtags ("ar-EG" → "ar").
 * Falls back to `fallback` when nothing matches.
 */
export const matchLocale = <T extends string>(
  preferred: readonly string[],
  supported: readonly T[],
  fallback: T,
): T => {
  const byCanonical = new Map(supported.map((locale) => [canonical(locale) ?? locale, locale]));
  for (const tag of preferred) {
    const normalized = canonical(tag);
    if (!normalized) continue;
    for (const candidate of fallbackChain(normalized)) {
      const match = byCanonical.get(candidate);
      if (match) return match;
    }
  }
  return fallback;
};
