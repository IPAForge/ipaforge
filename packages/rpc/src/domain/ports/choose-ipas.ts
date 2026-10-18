import type { ChosenIpa } from '@rpc/domain/types.ts'

/**
 * Asks the user for IPA files in the host's own file dialog (the desktop app's main process); the window never
 * sees the file system. Resolves with nothing when the user cancels.
 */
export type ChooseIpas = () => Promise<readonly ChosenIpa[]>
