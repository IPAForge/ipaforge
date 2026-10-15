// The default IpaSigner: @loadstar/signer with an Apple development identity (key imported through WebCrypto,
// chain from the bundled Apple certificates).
import type {
  IpaSigner,
  SignRequest
} from '@installer/domain/ports/ipa-signer.ts'
import { compact, type Logger } from '@loadstar/kernel'
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
} from '@loadstar/signer'

/** Apple issues RSA development certificates; Loadstar's keys come from `@loadstar/apple` as PKCS#8. */
const KEY_ALGORITHM = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const

/** Share of the step each signer stage reaches; bundle signing fills the span between them. */
const Progress = { reconciling: 0.1, signingEnd: 0.9, writing: 0.95 } as const

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
  if (event.stage === 'reconciling') return Progress.reconciling
  if (event.stage === 'writing') return Progress.writing
  const span = Progress.signingEnd - Progress.reconciling

  return (
    Progress.reconciling + (span * (event.index + 1)) / Math.max(1, event.total)
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
