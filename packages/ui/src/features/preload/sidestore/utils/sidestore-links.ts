// SideStore's own links (its URLHandler): `source` adds an app source, `install` downloads, signs and installs an
// .ipa on the iPhone. The iPhone's Camera opens them from a QR code.

const SCHEME = 'sidestore://'

/** Adds the source at `url` to SideStore. */
export const sideStoreSourceLink = (url: string): string =>
  `${SCHEME}source?url=${encodeURIComponent(url)}`

/** Has SideStore install the .ipa at `url`. */
export const sideStoreInstallLink = (url: string): string =>
  `${SCHEME}install?url=${encodeURIComponent(url)}`
