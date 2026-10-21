// Where a pairing file may go inside an app IPAForge installed (its own .ipa or a source app): a path the user
// typed from the app's instructions, kept to the app's Documents or Library and to a pairing file's name.

const PAIRING_PATH =
  /^(Documents|Library)\/[\w ./()+@-]+\.(plist|mobiledevicepairing)$/
const MAX_LENGTH = 200

/** The default for an app whose instructions don't say: where StikDebug and most tools look. */
export const DEFAULT_PAIRING_PATH = 'Documents/pairingFile.plist'

/** A path under Documents or Library, ending in .plist or .mobiledevicepairing, with no `..`, empty or dot segments. */
export const isPairingPath = (path: string): boolean =>
  path.length <= MAX_LENGTH &&
  PAIRING_PATH.test(path) &&
  path.split('/').every((segment) => segment !== '' && !/^\.+$/.test(segment))
