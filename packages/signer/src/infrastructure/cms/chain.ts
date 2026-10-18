import * as pkijs from 'pkijs'

import {
  ErrorCode,
  equalBytes,
  fromBase64,
  IPAForgeError,
  silentLogger
} from '@ipaforge/kernel'
import { APPLE_CERTIFICATES } from '@signer/infrastructure/cms/apple-certificates.ts'
import {
  nameDer,
  parseCertificate
} from '@signer/infrastructure/cms/certificate.ts'
import {
  OID_AIA_CA_ISSUERS,
  OID_AUTHORITY_INFO_ACCESS,
  OID_BASIC_CONSTRAINTS
} from '@signer/infrastructure/cms/oids.ts'
import type {
  ChainResolution,
  KnownCertificate,
  ResolveChainOptions
} from '@signer/infrastructure/cms/types.ts'

const bundled = (kind: 'root' | 'intermediate'): Uint8Array[] =>
  APPLE_CERTIFICATES.filter((c) => c.kind === kind).map((c) =>
    fromBase64(c.der)
  )

const unknownIssuer = (
  message: string,
  data: Record<string, unknown> = {}
): IPAForgeError =>
  new IPAForgeError(ErrorCode.UnknownIssuer, { message, data })

/** `caIssuers` URLs from the leaf's Authority Information Access extension. */
export const caIssuerUrls = (certificate: pkijs.Certificate): string[] => {
  const extension = certificate.extensions?.find(
    (e) => e.extnID === OID_AUTHORITY_INFO_ACCESS
  )
  const parsed = extension?.parsedValue
  if (!(parsed instanceof pkijs.InfoAccess)) return []
  return parsed.accessDescriptions
    .filter(
      (d) =>
        d.accessMethod === OID_AIA_CA_ISSUERS && d.accessLocation.type === 6
    ) // uniformResourceIdentifier
    .map((d) => String(d.accessLocation.value))
}

const isCa = (certificate: pkijs.Certificate): boolean => {
  const parsed = certificate.extensions?.find(
    (e) => e.extnID === OID_BASIC_CONSTRAINTS
  )?.parsedValue

  return parsed instanceof pkijs.BasicConstraints && parsed.cA === true
}

const isValidAt = (certificate: pkijs.Certificate, now: Date): boolean =>
  certificate.notBefore.value.getTime() <= now.getTime() &&
  now.getTime() <= certificate.notAfter.value.getTime()

/** True when `issuer` is named as the subject's issuer AND its key verifies the subject's signature. */
const issued = async (
  issuer: pkijs.Certificate,
  subject: pkijs.Certificate
): Promise<boolean> =>
  equalBytes(nameDer(issuer.subject), nameDer(subject.issuer)) &&
  (await subject.verify(issuer).catch(() => false))

const decodeCertificate = (bytes: Uint8Array): pkijs.Certificate => {
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, 64))
  if (text.includes('-----BEGIN CERTIFICATE-----')) {
    const pem = new TextDecoder().decode(bytes)

    return parseCertificate(
      fromBase64(pem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, ''))
    )
  }
  return parseCertificate(bytes)
}

const known = (ders: readonly Uint8Array[]): KnownCertificate[] =>
  ders.map((der) => ({ der, cert: parseCertificate(der) }))

const rootFor = async (
  roots: readonly KnownCertificate[],
  intermediate: pkijs.Certificate
): Promise<KnownCertificate | undefined> => {
  for (const root of roots)
    if (await issued(root.cert, intermediate)) return root
  return undefined
}

/** Step 1: a bundled intermediate that issued the leaf and chains to a trusted root. */
const bundledChain = async (
  leaf: pkijs.Certificate,
  intermediates: readonly KnownCertificate[],
  roots: readonly KnownCertificate[]
): Promise<ChainResolution | undefined> => {
  for (const intermediate of intermediates) {
    if (!(await issued(intermediate.cert, leaf))) continue
    const root = await rootFor(roots, intermediate.cert)
    if (root) return { chain: [intermediate.der, root.der], source: 'bundled' }
  }
  return undefined
}

/** Accepts a downloaded issuer only if it issued the leaf, is a currently valid CA and chains to a root. */
const verifyFetchedIssuer = async (
  der: Uint8Array,
  leaf: pkijs.Certificate,
  roots: readonly KnownCertificate[],
  now: Date
): Promise<{
  readonly intermediate: Uint8Array
  readonly root: KnownCertificate
}> => {
  const candidate = decodeCertificate(der)
  if (!(await issued(candidate, leaf)))
    throw new Error('downloaded certificate did not issue this certificate')
  if (!isCa(candidate)) throw new Error('downloaded certificate is not a CA')
  if (!isValidAt(candidate, now))
    throw new Error('downloaded certificate is expired or not yet valid')
  const root = await rootFor(roots, candidate)
  if (!root)
    throw new Error(
      'downloaded certificate does not chain to a trusted Apple root'
    )
  return {
    intermediate: new Uint8Array(candidate.toSchema(true).toBER(false)),
    root
  }
}

/** Step 2: try each AIA `caIssuers` URL in turn; fails with every reason when none is acceptable. */
const fetchedChain = async (
  leaf: pkijs.Certificate,
  roots: readonly KnownCertificate[],
  options: ResolveChainOptions
): Promise<ChainResolution> => {
  const urls = caIssuerUrls(leaf)
  if (!options.fetchIssuer || urls.length === 0) {
    throw unknownIssuer(
      urls.length === 0
        ? 'certificate issuer is not a known Apple CA and the certificate names no issuer download'
        : 'certificate issuer is not bundled; issuer download is not available here',
      { urls }
    )
  }

  const logger = options.logger ?? silentLogger
  const now = new Date()
  const failures: string[] = []
  for (const url of urls) {
    options.signal?.throwIfAborted()
    try {
      const der = await options.fetchIssuer(url, options.signal)
      const { intermediate, root } = await verifyFetchedIssuer(
        der,
        leaf,
        roots,
        now
      )
      logger.warn(
        'using an Apple intermediate that is not bundled; update apple-certificates.ts',
        { url }
      )
      return {
        chain: [intermediate, root.der],
        source: 'fetched',
        fetchedFrom: url
      }
    } catch (error) {
      failures.push(
        `${url}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  throw unknownIssuer(
    'could not establish a trusted chain for this certificate',
    { failures }
  )
}

/**
 * Resolves the chain to embed for a leaf certificate (signer-spec §5.1):
 *  1. a bundled intermediate that verifiably issued the leaf, plus the bundled root that issued it;
 *  2. otherwise the leaf's AIA `caIssuers` certificate, fetched and accepted only if it verifiably
 *     issued the leaf, is a valid CA, and is itself verifiably issued by a trusted root.
 * Roots are the only trust anchors; downloads can fill in intermediates, never replace roots.
 */
export const resolveChain = async (
  leafDer: Uint8Array,
  options: ResolveChainOptions = {}
): Promise<ChainResolution> => {
  const leaf = parseCertificate(leafDer)
  const roots = known(options.roots ?? bundled('root'))
  const intermediates = known(options.intermediates ?? bundled('intermediate'))

  return (
    (await bundledChain(leaf, intermediates, roots)) ??
    fetchedChain(leaf, roots, options)
  )
}

/** Bundled Apple certificates expiring before `before` (for maintenance warnings). */
export const expiringAppleCertificates = (
  before: Date
): { name: string; notAfter: Date }[] =>
  APPLE_CERTIFICATES.map((c) => ({
    name: c.name,
    notAfter: parseCertificate(fromBase64(c.der)).notAfter.value
  })).filter((c) => c.notAfter.getTime() < before.getTime())
