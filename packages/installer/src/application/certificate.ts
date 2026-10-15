// The team's development certificate: reuse the stored one while Apple still lists it, otherwise create one; at
// Apple's limit the user picks a certificate to revoke. A new certificate is stored right away, with its key, so
// a failure later in the flow never strands a certificate whose key is lost.
import { ask } from '@installer/application/ask.ts'
import { createCertificateStore } from '@installer/application/certificate-store.ts'
import type { InstallerDeps } from '@installer/deps.ts'
import {
  type CertificateChoice,
  PromptKind
} from '@installer/domain/prompts.ts'
import type { StepContext } from '@installer/pipeline/step.ts'
import type {
  CertificateIdentity,
  DeveloperServices,
  EnsureCertificateOptions,
  Team
} from '@loadstar/apple'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

export type CertificateOwner = {
  readonly accountId: string
  readonly team: Team
}

const isCertificateLimit = (error: unknown): error is LoadstarError =>
  error instanceof LoadstarError && error.code === ErrorCode.CertificateLimit

const isChoice = (value: unknown): value is CertificateChoice =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as CertificateChoice).serialNumber === 'string'

/** The certificates `apple.certificate_limit` lists (who made each one, when it expires). */
const revocable = (error: LoadstarError): CertificateChoice[] => {
  const listed = error.data?.certificates

  return Array.isArray(listed) ? listed.filter(isChoice) : []
}

const chooseRevocation = async (
  context: StepContext,
  error: LoadstarError
): Promise<string> => {
  const certificates = revocable(error)
  const serialNumber = await ask(context, PromptKind.RevokeCertificate, {
    certificates
  })
  if (
    certificates.some(
      (certificate) => certificate.serialNumber === serialNumber
    )
  )
    return serialNumber
  throw error
}

/** Ensures a certificate, revoking the one the user picks each time Apple is at its limit. */
const ensureWithRevoke = async (
  developer: DeveloperServices,
  team: Team,
  options: EnsureCertificateOptions,
  context: StepContext
): Promise<CertificateIdentity> => {
  for (;;) {
    try {
      return await developer.ensureCertificate(team, options)
    } catch (error) {
      if (!isCertificateLimit(error)) throw error
      await developer.revokeCertificate(
        team,
        await chooseRevocation(context, error)
      )
    }
  }
}

export const ensureTeamCertificate = async (
  deps: InstallerDeps,
  developer: DeveloperServices,
  context: StepContext,
  owner: CertificateOwner
): Promise<CertificateIdentity> => {
  const store = createCertificateStore(deps.secrets, deps.logger)
  const stored = await store.load(owner.accountId, owner.team.id)
  const options = compact({ machineName: deps.config.machineName, stored })
  const identity = await ensureWithRevoke(
    developer,
    owner.team,
    options,
    context
  )
  if (identity.certificate.serialNumber !== stored?.certificate.serialNumber) {
    await store.save(owner.accountId, owner.team.id, identity)
  }
  return identity
}

/** The stored identity for the certificate a run chose earlier. */
export const loadTeamCertificate = async (
  deps: InstallerDeps,
  owner: CertificateOwner,
  serialNumber: string
): Promise<CertificateIdentity> => {
  const identity = await createCertificateStore(deps.secrets, deps.logger).load(
    owner.accountId,
    owner.team.id
  )
  if (identity?.certificate.serialNumber === serialNumber) return identity
  throw new LoadstarError(ErrorCode.SigningIdentityInvalid, {
    message: 'the certificate chosen for this install is no longer stored',
    data: { team: owner.team.id }
  })
}
