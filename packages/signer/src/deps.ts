import { silentLogger, systemClock } from '@loadstar/kernel'
import type { SignerDeps } from '@signer/types.ts'

export const defaultSignerDeps: SignerDeps = {
  logger: silentLogger,
  clock: systemClock
}

/** Resolve partial deps and scope the logger to the signer. */
export const resolveDeps = (deps: Partial<SignerDeps> = {}): SignerDeps => ({
  logger: (deps.logger ?? defaultSignerDeps.logger).child({ scope: 'signer' }),
  clock: deps.clock ?? defaultSignerDeps.clock
})
