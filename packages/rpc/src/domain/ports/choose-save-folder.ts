/**
 * Asks the user for a folder in the host's own dialog (the desktop app's main process), where Save signed .ipa
 * instead writes. Resolves with its path, or nothing when the user cancels. The path stays on the server: the page
 * only gets an id for it.
 */
export type ChooseSaveFolder = () => Promise<string | undefined>
