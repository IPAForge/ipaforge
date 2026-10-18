// Apple ties a session to the machine identity it was created with (the anisette server's provisioning). Requests
// made with the session (app tokens, developer services) therefore ask for that server first, not whichever server
// happened to answer last; another server is used only when that one is down.

import type { AnisetteService } from '@apple/application/types.ts'
import type { AnisetteData, AppleSession } from '@apple/domain/types.ts'
import { compact } from '@ipaforge/kernel'

export const anisetteForSession = async (
  anisette: AnisetteService,
  session: AppleSession
): Promise<AnisetteData> => {
  const preferred = (await anisette.servers()).find(
    (server) => server.name === session.anisetteServer
  )

  return anisette.get(compact({ preferred }))
}
