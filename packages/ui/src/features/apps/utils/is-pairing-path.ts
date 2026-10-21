// The same rule the Engine applies (it checks again): a path under Documents or Library, ending in .plist or
// .mobiledevicepairing, with no `..`, empty or dot segments.
const PAIRING_PATH =
  /^(Documents|Library)\/[\w ./()+@-]+\.(plist|mobiledevicepairing)$/
const MAX_LENGTH = 200

/** Whether a pairing file may go at `path` inside an app. */
export const isPairingPath = (path: string): boolean =>
  path.length <= MAX_LENGTH &&
  PAIRING_PATH.test(path) &&
  path.split('/').every((segment) => segment !== '' && !/^\.+$/.test(segment))
