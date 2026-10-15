// Electron renderer: a sandboxed browser context, so it mounts the UI with the same browser services as the web entry.
import "@loadstar/ui/styles.css";
import type { LogLevel } from "@loadstar/kernel";
import { App, createBrowserServices } from "@loadstar/ui";
import { createHashHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const ROOT_ELEMENT_ID = "root";
/** Verbose while developing, quieter in a production build. */
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? "debug" : "info";

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error(`missing #${ROOT_ELEMENT_ID} in index.html`);

// A build is loaded from file://, where only the hash can carry the route.
createRoot(container).render(
  <StrictMode>
    <App services={createBrowserServices(window, LOG_LEVEL)} history={createHashHistory()} />
  </StrictMode>,
);
