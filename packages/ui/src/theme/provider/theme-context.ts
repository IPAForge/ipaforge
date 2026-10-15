import type { ThemeStore } from "@ui/theme/theme-store.ts";
import { createContext } from "react";

/** The app's theme store, provided by `ThemeProvider` and read through `useTheme`. */
export const ThemeContext = createContext<ThemeStore | undefined>(undefined);
