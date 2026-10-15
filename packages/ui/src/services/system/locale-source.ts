/**
 * The operating system's preferred languages, most preferred first (BCP 47 tags such as "pt-BR").
 * Browser: `navigator.languages`; the Electron renderer can supply `app.getPreferredSystemLanguages()`.
 */
export interface LocaleSource {
  preferredLanguages: () => readonly string[];
}

/** Reads `navigator.languages`, or `navigator.language` where the list is empty. */
export const createNavigatorLocaleSource = (navigator: Pick<Navigator, "languages" | "language">): LocaleSource => ({
  preferredLanguages: () => (navigator.languages.length > 0 ? navigator.languages : [navigator.language]),
});

/** A fixed list, for tests and hosts that already know the languages. */
export const createFixedLocaleSource = (languages: readonly string[]): LocaleSource => ({
  preferredLanguages: () => languages,
});
