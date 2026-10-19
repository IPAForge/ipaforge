import type { AccountState } from '@installer/domain/types.ts'
import type { SavedAccount } from '@ipaforge/apple'
import type { Channel } from '@ipaforge/catalog'
import type { AppFileTarget, PairingTarget } from '@ipaforge/device'

export type SideStoreVariant = 'sidestore' | 'livecontainer'

export type InstallSideStoreInput = {
  readonly udid: string
  /** A saved Apple account (`SavedAccount.id`). */
  readonly accountId: string
  readonly teamId?: string
  /** Default: the channel the catalog recommends for the device's iOS version. */
  readonly channel?: Channel
  readonly variant: SideStoreVariant
  /** Create App IDs even though Apple's count says none are left, when that count was negative (Try anyway). */
  readonly tryAnyway?: boolean
}

/** `replace` rewrites every file; `keep-existing` only writes the files an app does not have yet. */
export type PairingOverwrite = 'replace' | 'keep-existing'

export type PlacePairingInput = {
  readonly udid: string
  readonly accountId: string
  /** Apps to place it into; without them the user picks. */
  readonly bundleIds?: readonly string[]
  readonly overwrite?: PairingOverwrite
}

export type PairingState = AccountState & {
  readonly bundleIds?: readonly string[]
  readonly overwrite: PairingOverwrite
  /** The chosen apps' pairing paths, with each app's name. */
  readonly targets?: readonly PairingTarget[]
  readonly placed?: readonly AppFileTarget[]
}

export type SignInFlowInput = {
  readonly appleId: string
  /** Save the password (in the SecretStore) so an expired session can be renewed without asking. Default: no. */
  readonly rememberPassword?: boolean
}

export type SignInState = {
  readonly appleId: string
  readonly account?: SavedAccount
}
