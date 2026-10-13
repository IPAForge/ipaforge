import type { Clock, Logger } from "@loadstar/kernel";
import { silentLogger, systemClock } from "@loadstar/kernel";

/** Collaborators every public signer operation accepts. */
export interface SignerDeps {
  readonly logger: Logger;
  readonly clock: Clock;
}

export const defaultSignerDeps: SignerDeps = { logger: silentLogger, clock: systemClock };

/** Resolve partial deps and scope the logger to the signer. */
export const resolveDeps = (deps: Partial<SignerDeps> = {}): SignerDeps => ({
  logger: (deps.logger ?? defaultSignerDeps.logger).child({ scope: "signer" }),
  clock: deps.clock ?? defaultSignerDeps.clock,
});
