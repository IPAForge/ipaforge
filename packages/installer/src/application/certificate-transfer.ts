// The team's certificate between computers and SideStore, as a .p12: exporting the one this computer keeps (with its
// private key, under a password), and importing one made elsewhere so this computer signs with it too: no new
// certificate, no slot used. An import is kept only while Apple still lists that certificate for the team.
import { createCertificateStore } from '@installer/application/certificate-store.ts'
import { withTeam } from '@installer/application/portal.ts'
import type { TeamQuery } from '@installer/engine/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import {
  exportPkcs12,
  importPkcs12,
  keyMatchesCertificate
} from '@ipaforge/signer'

const FRIENDLY_NAME = 'IPAForge'

/** A serial as hex without leading zeros, upper case: how a .p12 and Apple are compared. */
const normalSerial = (serial: string) => serial.toUpperCase().replace(/^0+/, '')

/** This computer's certificate for the team, with its private key, in a .p12 under `password`. */
export const exportCertificate = (
  deps: InstallerDeps,
  query: TeamQuery,
  password: string
): Promise<Uint8Array> =>
  withTeam(deps, query, async (_developer, team) => {
    const stored = await createCertificateStore(deps.secrets, deps.logger).load(
      query.accountId,
      team.id
    )
    const content = stored?.certificate.content
    if (!(stored && content))
      throw new IPAForgeError(ErrorCode.CertificateNotStored, {
        data: { team: team.id }
      })
    deps.logger.info('certificate exported as .p12', { team: team.id })

    return exportPkcs12({
      certificate: content,
      privateKey: stored.privateKey,
      password,
      friendlyName: FRIENDLY_NAME
    })
  })

/**
 * Keeps a .p12's certificate and key as this computer's for the team, once Apple lists that certificate for it and
 * the key is the certificate's. Answers with the certificate's serial.
 */
export const importCertificate = (
  deps: InstallerDeps,
  query: TeamQuery,
  p12: Uint8Array,
  password: string
): Promise<{ readonly serialNumber: string }> =>
  withTeam(deps, query, async (developer, team) => {
    const { serialNumber, privateKey } = importPkcs12(p12, password)
    const listed = (await developer.certificates(team)).find(
      (certificate) => normalSerial(certificate.serialNumber) === serialNumber
    )
    if (!listed?.content)
      throw new IPAForgeError(ErrorCode.CertificateNotOnTeam, {
        data: { team: team.id }
      })
    if (!keyMatchesCertificate(privateKey, listed.content))
      throw new IPAForgeError(ErrorCode.InvalidCertificate, {
        message: "the .p12's key is not the certificate's"
      })
    await createCertificateStore(deps.secrets, deps.logger).save(
      query.accountId,
      team.id,
      { certificate: listed, privateKey }
    )
    deps.logger.info('certificate imported from a .p12', { team: team.id })

    return { serialNumber: listed.serialNumber }
  })
