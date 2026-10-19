// The team's certificates that still sign: listed by Apple, not revoked and not expired, by serial number. An app
// signed with one of them keeps working with a new profile; SideStore holding one can refresh apps by itself.
import type { InstallerDeps } from '@installer/types.ts'
import type { DeveloperServices, Team } from '@ipaforge/apple'

const REVOKED = 'Revoked'

/** Serial numbers in upper case, as apps carry them in different cases. */
export const validCertificateSerials = async (
  deps: InstallerDeps,
  developer: DeveloperServices,
  team: Team
): Promise<ReadonlySet<string>> => {
  const now = deps.clock.now()

  return new Set(
    (await developer.certificates(team))
      .filter(
        (certificate) =>
          certificate.status !== REVOKED &&
          (!certificate.expiresAt || certificate.expiresAt > now)
      )
      .map((certificate) => certificate.serialNumber.toUpperCase())
  )
}
