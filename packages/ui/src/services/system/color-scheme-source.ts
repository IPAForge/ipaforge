export type ColorScheme = "light" | "dark";

/** The operating system's light/dark preference, followed when the colour mode is `system`. */
export interface ColorSchemeSource {
  current: () => ColorScheme;
  /** Calls `listener` whenever the OS preference changes; returns the unsubscribe function. */
  subscribe: (listener: (scheme: ColorScheme) => void) => () => void;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

const toScheme = (prefersDark: boolean): ColorScheme => (prefersDark ? "dark" : "light");

/** Reads `prefers-color-scheme`, which both the browser and the Electron renderer report from the OS. */
export const createMediaColorSchemeSource = (matchMedia: Window["matchMedia"]): ColorSchemeSource => {
  const query = matchMedia(DARK_QUERY);
  return {
    current: () => toScheme(query.matches),
    subscribe: (listener) => {
      const onChange = (event: MediaQueryListEvent) => listener(toScheme(event.matches));
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
  };
};

/** A fixed scheme for tests and hosts without a media query. */
export const createFixedColorSchemeSource = (scheme: ColorScheme): ColorSchemeSource => ({
  current: () => scheme,
  subscribe: () => () => {},
});
