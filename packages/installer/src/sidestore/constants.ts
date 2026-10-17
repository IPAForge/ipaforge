// Names SideStore and LiveContainer look for at runtime (docs/design/failure-catalogue.md §4). They are fixed by
// those apps, not configuration.

/** Original bundle ID of SideStore; extensions and the LiveContainer framework start with it. */
export const SIDESTORE_BUNDLE_ID = 'com.SideStore.SideStore'
export const LIVECONTAINER_BUNDLE_ID = 'com.kdt.livecontainer'

export const FRAMEWORKS_DIR = 'Frameworks'
/**
 * The SideStore framework inside `LiveContainer.app/Frameworks`. Believed name, not yet confirmed on a
 * device: detection also accepts any framework there whose bundle ID starts with SIDESTORE_BUNDLE_ID.
 */
export const SIDESTORE_FRAMEWORK_NAME = 'SideStoreApp.framework'

/** PKCS#12 SideStore imports from its bundle root; the password is the certificate's machineId. */
export const CERTIFICATE_FILE = 'ALTCertificate.p12'
/** Info.plist key holding the certificate's serial number. */
export const CERTIFICATE_ID_KEY = 'ALTCertificateID'

/** `CodeBundle.path` of the main app. */
export const MAIN_APP_PATH = ''

export const FRAMEWORK_PREFIX = `${FRAMEWORKS_DIR}/`
