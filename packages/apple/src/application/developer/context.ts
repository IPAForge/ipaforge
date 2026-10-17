// What every developer-services use case shares: authenticated requests for one session, and logging of
// malformed list entries.

import type { AppTokenService } from '@apple/application/app-token.ts'
import { anisetteForSession } from '@apple/application/session-anisette.ts'
import type { AnisetteService } from '@apple/application/types.ts'
import type { AppleSession, Team } from '@apple/domain/types.ts'
import { developerRequest } from '@apple/infrastructure/developer/client.ts'
import type {
  DeveloperFields,
  DeveloperPlatform,
  DeveloperRequestOptions
} from '@apple/infrastructure/developer/types.ts'
import type { AppleDeps } from '@apple/types.ts'
import type { PlistDict } from '@loadstar/kernel'

export type DeveloperContext = {
  readonly deps: AppleDeps
  readonly request: (
    action: string,
    platform: DeveloperPlatform,
    fields?: DeveloperFields
  ) => Promise<PlistDict>
  /** An `ios/` request on behalf of `team` (`teamId` is sent first). */
  readonly teamRequest: (
    team: Team,
    action: string,
    fields?: DeveloperFields
  ) => Promise<PlistDict>
  /** A callback that logs a skipped malformed `what` entry (only its keys, never values). */
  readonly skip: (what: string) => (entry: unknown) => void
}

export const createDeveloperContext = (
  deps: AppleDeps,
  anisette: AnisetteService,
  tokens: AppTokenService,
  session: AppleSession
): DeveloperContext => {
  const options: DeveloperRequestOptions = {
    anisette: () => anisetteForSession(anisette, session),
    auth: async () => ({
      token: (await tokens.appToken(session)).token,
      adsid: session.adsid
    })
  }
  const request: DeveloperContext['request'] = (
    action,
    platform,
    fields = []
  ) => developerRequest(deps, options, action, platform, fields)

  return {
    deps,
    request,
    teamRequest: (team, action, fields = []) =>
      request(action, 'ios', [['teamId', team.id], ...fields]),
    skip: (what) => (entry) =>
      deps.logger.warn(`skipped a malformed ${what} entry`, {
        keys: entry && typeof entry === 'object' ? Object.keys(entry) : []
      })
  }
}
