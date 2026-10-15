import type { Logger } from "@loadstar/kernel";
import type { ColorSchemeSource } from "@ui/services/color-scheme-source.ts";
import type { PreferencesStore } from "@ui/services/preferences-store.ts";
import { createContext } from "react";

/**
 * Everything the UI gets from its host, swapped per environment (browser, Electron renderer, tests).
 * The Engine client joins these in a later phase.
 */
export interface UiServices {
  /** `App` scopes it to `ui`; features add their own child scope (`ui.theme`, `ui.router`). */
  readonly logger: Logger;
  readonly preferences: PreferencesStore;
  readonly colorScheme: ColorSchemeSource;
}

export const UiServicesContext = createContext<UiServices | undefined>(undefined);
