/**
 * Catalog apps that get this computer's pairing file once installed, and their pairing-app entry: SideStore, or the
 * SideStore inside LiveContainer. Installed from the Preload page they get it too, as from the Install page.
 */
export const CATALOG_PAIRING_APPS: Readonly<Record<string, string>> = {
  sidestore: 'sidestore',
  'livecontainer-sidestore': 'livecontainer'
}
