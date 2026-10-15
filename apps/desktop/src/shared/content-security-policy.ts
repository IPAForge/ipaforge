// The renderer's Content-Security-Policy, injected into index.html at build time (electron.vite.config.ts).
// The window loads only the bundled UI: no remote code, frames, plugins or form posts.

const PRODUCTION_DIRECTIVES: Readonly<Record<string, string>> = {
  'default-src': "'none'",
  'script-src': "'self'",
  // React Aria and HeroUI set inline `style` attributes for positioning (popovers, menus).
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data:",
  'font-src': "'self' data:",
  'connect-src': "'self'",
  'base-uri': "'none'",
  'form-action': "'none'",
  'object-src': "'none'",
  'frame-src': "'none'",
  'worker-src': "'none'"
}

/** The Vite dev server adds an inline React Refresh preamble and a hot-reload WebSocket. */
const DEVELOPMENT_DIRECTIVES: Readonly<Record<string, string>> = {
  ...PRODUCTION_DIRECTIVES,
  'script-src': "'self' 'unsafe-inline'",
  'connect-src': "'self' ws://localhost:* ws://127.0.0.1:*"
}

const serialize = (directives: Readonly<Record<string, string>>): string =>
  Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join('; ')

export const PRODUCTION_CONTENT_SECURITY_POLICY = serialize(
  PRODUCTION_DIRECTIVES
)
export const DEVELOPMENT_CONTENT_SECURITY_POLICY = serialize(
  DEVELOPMENT_DIRECTIVES
)
