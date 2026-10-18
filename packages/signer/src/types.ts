import type { Clock, Logger } from '@ipaforge/kernel'
import type { Hasher } from '@signer/domain/ports/types.ts'

/** Collaborators every public signer operation accepts. */
export type SignerDeps = {
  readonly logger: Logger
  readonly clock: Clock
}

/** What signing a binary or a bundle needs: the shared collaborators plus a hasher. */
export type SigningDeps = SignerDeps & {
  readonly hasher: Hasher
}
