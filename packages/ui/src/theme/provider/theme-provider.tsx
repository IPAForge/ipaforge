import { useUiServices } from "@ui/hooks/use-ui-services.ts";
import { applyPalette } from "@ui/theme/apply-palette.ts";
import { palettes } from "@ui/theme/palettes.ts";
import { ThemeContext } from "@ui/theme/theme-context.ts";
import { createThemeStore } from "@ui/theme/theme-store.ts";
import { type ReactNode, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";

/** Owns the theme store for the app's lifetime and keeps `<html>` in sync with it. */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { preferences, colorScheme, logger } = useUiServices();
  const [store] = useState(() => createThemeStore({ preferences, system: colorScheme, logger }));
  const { palette, scheme } = useSyncExternalStore(store.subscribe, store.getState);

  useEffect(() => store.followSystem(), [store]);
  useLayoutEffect(() => applyPalette(document.documentElement, palettes[palette][scheme], scheme), [palette, scheme]);

  return <ThemeContext value={store}>{children}</ThemeContext>;
};
