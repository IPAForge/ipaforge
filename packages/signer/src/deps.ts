import type { Clock, Logger } from '@loadstar/kernel'
import { silentLogger, systemClock } from '@loadstar/kernel'
import type { Hasher } from '@signer/domain/ports/hasher.ts'

/** Collaborators every public signer operation accepts. */
export type SignerDeps = {
  readonly logger: Logger
  readonly clock: Clock
}

/** What signing a binary or a bundle needs: the shared collaborators plus a hasher. */
export type SigningDeps = SignerDeps & {
  readonly hasher: Hasher
}

export const defaultSignerDeps: SignerDeps = {
  logger: silentLogger,
  clock: systemClock
}

/** Resolve partial deps and scope the logger to the signer. */
export const resolveDeps = (deps: Partial<SignerDeps> = {}): SignerDeps => ({
  logger: (deps.logger ?? defaultSignerDeps.logger).child({ scope: 'signer' }),
  clock: deps.clock ?? defaultSignerDeps.clock
})
