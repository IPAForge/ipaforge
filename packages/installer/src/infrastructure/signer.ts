// The default IpaSigner: @ipaforge/signer with an Apple development identity (key imported through WebCrypto,
// chain from the bundled Apple certificates).
import type { IpaSigner, SignRequest } from '@installer/domain/ports/types.ts'
import {
  KEY_ALGORITHM,
  SIGN_PROGRESS
} from '@installer/infrastructure/constants.ts'
import { compact, type Logger } from '@ipaforge/kernel'
import {
  discoverBundles,
  inspectIpa,
  readIpa,
  resolveChain,
  resolveLimits,
  type SignerProgress,
  type SignIpaOptions,
  type SigningIdentity,
  signIpa
} from '@ipaforge/signer'

const signingIdentity = async (
  request: SignRequest
): Promise<SigningIdentity> => {
  // A copy, because WebCrypto takes only buffers backed by a plain ArrayBuffer.
  const pkcs8 = new Uint8Array(request.privateKey)
  const privateKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    KEY_ALGORITHM,
    false,
    ['sign']
  )
  const { chain } = await resolveChain(
    request.certificate,
    compact({ signal: request.signal })
  )

  return { certificate: request.certificate, chain, privateKey }
}

const progressFraction = (event: SignerProgress): number => {
  if (event.stage === 'reading') return 0
  if (event.stage === 'reconciling') return SIGN_PROGRESS.reconciling
  if (event.stage === 'writing') return SIGN_PROGRESS.writing
  const span = SIGN_PROGRESS.signingEnd - SIGN_PROGRESS.reconciling

  return (
    SIGN_PROGRESS.reconciling +
    (span * (event.index + 1)) / Math.max(1, event.total)
  )
}

const signOptions = (
  request: SignRequest,
  identity: SigningIdentity
): SignIpaOptions =>
  compact({
    signing: { kind: 'identity' as const, identity, teamId: request.teamId },
    sideload: compact({
      teamId: request.teamId,
      newMainBundleId: request.newMainBundleId,
      certificate: request.certificate,
      profiles: request.profiles,
      appGroups: request.appGroups,
      deviceUdid: request.deviceUdid
    }),
    additions: request.additions,
    onProgress:
      request.onProgress &&
      ((event: SignerProgress) =>
        request.onProgress?.(progressFraction(event))),
    signal: request.signal
  })

export const createDefaultSigner = (logger: Logger): IpaSigner => ({
  inspect: (file, signal) => inspectIpa(file, compact({ signal }), { logger }),
  bundles: async (file, signal) => {
    const limits = resolveLimits()
    const ipa = await readIpa(
      file,
      compact({ logger, limits: limits.ipa, signal })
    )

    return discoverBundles(ipa.app, limits)
  },
  sign: async (file, request) =>
    (
      await signIpa(
        file,
        signOptions(request, await signingIdentity(request)),
        { logger }
      )
    ).ipa
})
