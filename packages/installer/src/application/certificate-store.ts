// The development certificate each account and team signs with, kept with its private key in the SecretStore so
// the next run reuses it instead of using up another certificate slot.

import { z } from 'zod'

import { STORE_VERSION } from '@installer/application/constants.ts'
import type {
  CertificateStore,
  StoredCertificate
} from '@installer/application/types.ts'
import type {
  CertificateIdentity,
  DevelopmentCertificate
} from '@ipaforge/apple'
import {
  compact,
  fromBase64,
  type Logger,
  type SecretStore,
  toBase64,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

export const certificateKey = (accountId: string, teamId: string): string =>
  `installer/certificate/${accountId}/${teamId}`

export const storedSchema = z.object({
  version: z.literal(STORE_VERSION),
  serialNumber: z.string().min(1),
  id: z.string().optional(),
  name: z.string().optional(),
  machineName: z.string().optional(),
  machineId: z.string().optional(),
  platform: z.string().optional(),
  expiresAt: z.string().optional(),
  content: z.string().min(1),
  privateKey: z.string().min(1)
})

const encode = ({ certificate, privateKey }: CertificateIdentity): Uint8Array =>
  utf8Encode(
    JSON.stringify(
      compact({
        version: STORE_VERSION,
        serialNumber: certificate.serialNumber,
        id: certificate.id,
        name: certificate.name,
        machineName: certificate.machineName,
        machineId: certificate.machineId,
        platform: certificate.platform,
        expiresAt: certificate.expiresAt?.toISOString(),
        content: certificate.content && toBase64(certificate.content),
        privateKey: toBase64(privateKey)
      })
    )
  )

const toIdentity = (stored: StoredCertificate): CertificateIdentity => {
  const certificate: DevelopmentCertificate = compact({
    serialNumber: stored.serialNumber,
    id: stored.id,
    name: stored.name,
    machineName: stored.machineName,
    machineId: stored.machineId,
    platform: stored.platform,
    expiresAt:
      stored.expiresAt === undefined ? undefined : new Date(stored.expiresAt),
    content: fromBase64(stored.content)
  })

  return { certificate, privateKey: fromBase64(stored.privateKey) }
}

const decode = (raw: Uint8Array): CertificateIdentity | undefined => {
  try {
    const parsed = storedSchema.safeParse(JSON.parse(utf8Decode(raw)))

    return parsed.success ? toIdentity(parsed.data) : undefined
  } catch {
    return undefined
  }
}

export const createCertificateStore = (
  secrets: SecretStore,
  logger: Logger
): CertificateStore => ({
  load: async (accountId, teamId) => {
    const raw = await secrets.get(certificateKey(accountId, teamId))
    if (!raw) return undefined
    const identity = decode(raw)
    // An unreadable entry is treated as missing: a new certificate is made and overwrites it.
    if (!identity)
      logger.warn('ignoring an unreadable stored certificate', { team: teamId })
    return identity
  },
  save: (accountId, teamId, identity) =>
    secrets.set(certificateKey(accountId, teamId), encode(identity))
})
