// Names fixed by Apple's bundle and IPA layout (not configuration).

export const INFO_PLIST = "Info.plist";
export const PKG_INFO = "PkgInfo";
export const CODE_SIGNATURE_DIR = "_CodeSignature";
export const CODE_RESOURCES = "CodeResources";
/** `_CodeSignature/CodeResources`, relative to a bundle. */
export const CODE_RESOURCES_PATH = `${CODE_SIGNATURE_DIR}/${CODE_RESOURCES}`;
export const EMBEDDED_PROFILE = "embedded.mobileprovision";
/** FairPlay (App Store DRM) metadata directory; stale after re-signing. */
export const SC_INFO_DIR = "SC_Info";
export const MAS_RECEIPT_DIR = "_MASReceipt";
export const IPA_PAYLOAD_DIR = "Payload";

/** Unix file-type and permission bits as stored in zip external attributes. */
export const S_IFMT = 0o170000;
export const S_IFREG = 0o100000;
export const S_IFDIR = 0o040000;
export const S_IFLNK = 0o120000;
export const PERMISSION_BITS = 0o7777;
export const DEFAULT_FILE_MODE = 0o644;
export const EXECUTABLE_MODE = 0o755;
export const DIRECTORY_MODE = 0o755;
/** Mode recorded for symlinks (their permissions are not used by iOS). */
export const SYMLINK_MODE = 0o755;
/** Permission bits written for symlinks in an archive (conventionally rwxrwxrwx). */
export const SYMLINK_ARCHIVE_PERMISSIONS = 0o777;
