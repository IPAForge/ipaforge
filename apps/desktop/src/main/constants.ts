/**
 * The only pages the UI may open, in the user's default browser: a new IPAForge issue (Report the problem),
 * IPAForge's releases (an update to download by hand) and Apple's account and developer pages (fixes such as
 * verifying the email or accepting the agreement). Each entry is an origin and the path the page must start with.
 */
export const allowedExternalLinks = [
  { origin: 'https://github.com', path: '/IPAForge/ipaforge/issues/new' },
  { origin: 'https://github.com', path: '/IPAForge/ipaforge/releases' },
  { origin: 'https://account.apple.com', path: '/' },
  { origin: 'https://developer.apple.com', path: '/account' }
] as const

/**
 * The only permission the UI gets: writing text to the clipboard (Copy diagnostics, copying an Apple link).
 * Camera, microphone, notifications and every other request are refused.
 */
export const allowedPermissions: ReadonlySet<string> = new Set([
  'clipboard-sanitized-write'
])
