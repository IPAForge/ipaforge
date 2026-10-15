import { createLogger, type LogRecord } from "@loadstar/kernel";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { App } from "@ui/App.tsx";
import type { ColorScheme, ColorSchemeSource } from "@ui/services/color-scheme-source.ts";
import { createMemoryPreferencesStore } from "@ui/services/preferences-store.ts";
import type { UiServices } from "@ui/services/ui-services.ts";

/** A colour-scheme source the test can flip, like the OS switching to dark. */
export const createControllableScheme = (initial: ColorScheme) => {
  let scheme = initial;
  const listeners = new Set<(scheme: ColorScheme) => void>();
  const source: ColorSchemeSource = {
    current: () => scheme,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const change = (next: ColorScheme) => {
    scheme = next;
    for (const listener of listeners) listener(next);
  };
  return { source, change, listenerCount: () => listeners.size };
};

/** Services backed by memory, collecting every log record at debug level. */
export const createTestServices = (preferences: Readonly<Record<string, string>> = {}) => {
  const records: LogRecord[] = [];
  const scheme = createControllableScheme("light");
  const services: UiServices = {
    logger: createLogger({ level: "debug", sink: (record) => records.push(record) }),
    preferences: createMemoryPreferencesStore(preferences),
    colorScheme: scheme.source,
  };
  return { services, records, scheme };
};

/** Renders the whole app at `path` with in-memory services. */
export const renderApp = (path = "/") => {
  const test = createTestServices();
  const history = createMemoryHistory({ initialEntries: [path] });
  return { ...test, history, ...render(<App services={test.services} history={history} />) };
};
