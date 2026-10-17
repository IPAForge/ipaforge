/**
 * Maintainer tool (macOS): compare Loadstar's signature with Apple codesign's for a REAL Apple
 * Development certificate. See fixtures/signer/REAL-CERT.md.
 *
 *   pnpm --filter @loadstar/signer compare-real-cert -- --p12 identity.p12 [--password …]   (or LOADSTAR_P12_PASSWORD)
 *
 * The .p12 is imported into a temporary keychain that is deleted afterwards; nothing is written
 * to your login keychain. The private key is passed to Loadstar in memory only.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

import {
  compact,
  fromBase64,
  silentLogger,
  systemClock,
  toHex
} from '@loadstar/kernel'
import { readTree } from '@signer/__tests__/fixtures.ts'
import {
  CSSLOT_SIGNATURESLOT,
  parseSuperBlob
} from '@signer/domain/blobs/index.ts'
import type { BundleTree } from '@signer/domain/bundle/tree.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import {
  certificateInfo,
  createHasher,
  isPlistDict,
  parsePlist,
  resolveChain,
  signBundle
} from '@signer/index.ts'
import {
  OID_APPLE_CDHASHES,
  OID_APPLE_CDHASHES2,
  OID_MESSAGE_DIGEST
} from '@signer/infrastructure/cms/oids.ts'

const FIXTURES = join(import.meta.dirname, '../../../fixtures/signer')

const ENTITLEMENTS_BY_KIND: ReadonlyMap<string, string> = new Map([
  ['app', 'entitlements/app.plist'],
  ['appex', 'entitlements/appex.plist']
])

const SIGNATURE_LABEL = 'signature:'
const MASKED_SIGNATURE = 'signature: <sig>'
const ENTRY_INDENT = { min: 4, max: 6 }
const WHITESPACE = /\s/
const WORD_CHARACTER = /\w/

/**
 * Whether the dump line after the line break at `newline` ends a signature value: an entry
 * indented 4 to 6 columns, or `unsignedAttrs` at any depth.
 */
const endsSignature = (text: string, newline: number): boolean => {
  let end = newline + 1
  while (end < text.length && WHITESPACE.test(text.charAt(end))) end++
  const indent = end - newline - 1
  const isEntry =
    indent >= ENTRY_INDENT.min &&
    indent <= ENTRY_INDENT.max &&
    WORD_CHARACTER.test(text.charAt(end))

  return isEntry || text.startsWith('unsignedAttrs', end)
}

/** The line break that ends the signature value starting at `from`; -1 when none does. */
const signatureEnd = (text: string, from: number): number => {
  let newline = text.indexOf('\n', from)
  while (newline >= 0 && !endsSignature(text, newline))
    newline = text.indexOf('\n', newline + 1)
  return newline
}

/** openssl's `-print` dump with every signature value replaced by `<sig>`. Linear, unlike a lazy regex. */
const maskSignatures = (text: string): string => {
  const parts: string[] = []
  let from = 0
  for (
    let start = text.indexOf(SIGNATURE_LABEL);
    start >= 0;
    start = text.indexOf(SIGNATURE_LABEL, from)
  ) {
    const end = signatureEnd(text, start + SIGNATURE_LABEL.length)
    if (end < 0) break
    parts.push(text.slice(from, start), MASKED_SIGNATURE)
    from = end
  }
  parts.push(text.slice(from))
  return parts.join('')
}

/** messageDigest, cdhashes2 and the cdhashes plist must all be derived from `cd` (SHA-256 / truncated). */
const cdAttributesConsistent = async (
  cms: Uint8Array,
  cd: Uint8Array
): Promise<boolean> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', cd as Uint8Array<ArrayBuffer>)
  )
  const signed = new pkijs.SignedData({
    schema: pkijs.ContentInfo.fromBER(
      cms.buffer.slice(
        cms.byteOffset,
        cms.byteOffset + cms.byteLength
      ) as ArrayBuffer
    ).content
  })
  const attributes = signed.signerInfos[0]?.signedAttrs?.attributes ?? []
  const octets = (type: string, index = 0): Uint8Array | undefined => {
    const value = attributes.find((a) => a.type === type)?.values[index]
    if (value instanceof asn1js.OctetString)
      return new Uint8Array(value.valueBlock.valueHexView)
    if (value instanceof asn1js.Sequence) {
      const inner = value.valueBlock.value[1]

      return inner instanceof asn1js.OctetString
        ? new Uint8Array(inner.valueBlock.valueHexView)
        : undefined
    }
    return undefined
  }
  const plist = parsePlist(octets(OID_APPLE_CDHASHES) ?? new Uint8Array())
  const listed =
    isPlistDict(plist) && Array.isArray(plist.cdhashes)
      ? plist.cdhashes[0]
      : undefined

  return (
    toHex(octets(OID_MESSAGE_DIGEST) ?? new Uint8Array()) === toHex(digest) &&
    toHex(octets(OID_APPLE_CDHASHES2) ?? new Uint8Array()) === toHex(digest) &&
    listed instanceof Uint8Array &&
    toHex(listed) === toHex(digest.subarray(0, 20))
  )
}

/** Which hash slots of two same-shaped CodeDirectories differ ("special -3", "page 0", …, or "header"). */
const differingHashSlots = (a: Uint8Array, b: Uint8Array): string[] => {
  const view = (cd: Uint8Array) =>
    new DataView(cd.buffer, cd.byteOffset, cd.byteLength)
  const [va, vb] = [view(a), view(b)]
  if (a.byteLength !== b.byteLength || va.getUint32(16) !== vb.getUint32(16))
    return ['header']
  const hashOffset = va.getUint32(16)
  const nSpecial = va.getUint32(24)
  const nCode = va.getUint32(28)
  const size = a[36] ?? 32
  const out: string[] = []
  if (
    toHex(a.subarray(0, hashOffset - nSpecial * size)) !==
    toHex(b.subarray(0, hashOffset - nSpecial * size))
  ) {
    out.push('header')
  }
  for (let i = 1; i <= nSpecial; i++) {
    const at = hashOffset - i * size
    if (toHex(a.subarray(at, at + size)) !== toHex(b.subarray(at, at + size)))
      out.push(`special -${i}`)
  }
  for (let i = 0; i < nCode; i++) {
    const at = hashOffset + i * size
    if (toHex(a.subarray(at, at + size)) !== toHex(b.subarray(at, at + size)))
      out.push(`page ${i}`)
  }
  return out
}
const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name)

  return index >= 0 ? process.argv[index + 1] : undefined
}
const run = (cmd: string, args: readonly string[], input?: string): string =>
  execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(input ? { input } : {})
  })
const pemBody = (pem: string, label: string): Uint8Array =>
  fromBase64(
    pem.match(
      new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`)
    )?.[1] ?? ''
  )

const p12 = arg('--p12')
const password = arg('--password') ?? process.env.LOADSTAR_P12_PASSWORD ?? ''
if (!p12) {
  console.error('usage: compare-real-cert.ts --p12 <file> [--password <pw>]')
  process.exit(2)
}

const work = mkdtempSync(join(tmpdir(), 'loadstar-realcert-'))
const keychain = join(work, 'compare.keychain-db')
const report: string[] = []
let originalSearchList: string[] | undefined
let failures = 0
const check = (label: string, ok: boolean, detail = ''): void => {
  const mark = ok ? '✓' : '✗'
  const suffix = detail ? `  ${detail}` : ''
  report.push(`${mark} ${label}${suffix}`)
  if (!ok) failures++
}

try {
  // 1. certificate + key out of the .p12 (in memory / temp dir only)
  const certPem = run('openssl', [
    'pkcs12',
    '-in',
    p12,
    '-nokeys',
    '-clcerts',
    '-passin',
    `pass:${password}`,
    '-legacy'
  ])
  const keyPem = run('openssl', [
    'pkcs12',
    '-in',
    p12,
    '-nocerts',
    '-nodes',
    '-passin',
    `pass:${password}`,
    '-legacy'
  ])
  const pkcs8Pem = run('openssl', ['pkcs8', '-topk8', '-nocrypt'], keyPem)
  const certificate = pemBody(certPem, 'CERTIFICATE')
  const info = certificateInfo(certificate)
  const teamId = info.organizationalUnit ?? ''
  // bundled Apple intermediates first, then the certificate's own issuer link (verified to an Apple root)
  const resolution = await resolveChain(certificate, {
    fetchIssuer: async (url) =>
      new Uint8Array(await (await fetch(url)).arrayBuffer())
  })
  const chain = [...resolution.chain]
  const fetchedFrom = resolution.fetchedFrom
    ? ` from ${resolution.fetchedFrom}`
    : ''
  report.push(
    `certificate: ${info.commonName} (team ${teamId}), chain: ${chain.length} certs (${resolution.source}${fetchedFrom})`
  )

  // 2. temporary keychain with the identity and its Apple chain, for codesign
  run('security', ['create-keychain', '-p', 'loadstar', keychain])
  run('security', ['unlock-keychain', '-p', 'loadstar', keychain])
  run('security', ['set-keychain-settings', keychain]) // no auto-lock while the comparison runs
  run('security', [
    'import',
    p12,
    '-k',
    keychain,
    '-P',
    password,
    '-T',
    '/usr/bin/codesign'
  ])
  chain.forEach((der, index) => {
    const file = join(work, `chain-${index}.cer`)
    writeFileSync(file, der)
    // the root may already be trusted system-wide; a duplicate import is harmless
    spawnSync('security', ['import', file, '-k', keychain], { stdio: 'ignore' })
  })
  run('security', [
    'set-key-partition-list',
    '-S',
    'apple-tool:,apple:',
    '-s',
    '-k',
    'loadstar',
    keychain
  ])
  // macOS builds the trust chain from the user keychain search list, so add the temporary keychain to it
  // for the duration of the run; the original list is restored in `finally`.
  originalSearchList = run('security', ['list-keychains', '-d', 'user'])
    .split('\n')
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .filter((line) => line.length > 0)
  run('security', [
    'list-keychains',
    '-d',
    'user',
    '-s',
    keychain,
    ...originalSearchList
  ])

  const identities = run('security', [
    'find-identity',
    '-v',
    '-p',
    'codesigning',
    keychain
  ])
  const identityHash = identities.match(/\b([0-9A-F]{40})\b/)?.[1]
  if (!identityHash) {
    const all = run('security', [
      'find-identity',
      '-p',
      'codesigning',
      keychain
    ]).trim()
    throw new Error(
      `no valid codesigning identity in the temporary keychain. macOS reports:\n${all}`
    )
  }
  report.push(`identity: ${identityHash} (valid for code signing)`)

  // 3. Apple codesign, bottom-up, same inputs as the ad-hoc fixtures
  const appleApp = join(work, 'apple/Test.app')
  cpSync(join(FIXTURES, 'inputs/Test.app'), appleApp, {
    recursive: true,
    verbatimSymlinks: true
  })
  const sign = (
    path: string,
    entitlements?: string,
    identifier?: string
  ): void => {
    const args = [
      '-f',
      '-s',
      identityHash,
      '--keychain',
      keychain,
      '--timestamp=none',
      '--generate-entitlement-der'
    ]
    if (identifier) args.push('-i', identifier)
    if (entitlements) args.push('--entitlements', join(FIXTURES, entitlements))
    run('codesign', [...args, path])
  }
  sign(join(appleApp, 'Frameworks/Lib.framework'))
  sign(join(appleApp, 'Frameworks/libloose.dylib'), undefined, 'libloose')
  sign(join(appleApp, 'PlugIns/Ext.appex'), 'entitlements/appex.plist')
  sign(appleApp, 'entitlements/app.plist')

  // 4. Loadstar, same certificate/key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemBody(pkcs8Pem, 'PRIVATE KEY') as Uint8Array<ArrayBuffer>,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const tree: BundleTree = new Map(
    readTree(join(FIXTURES, 'inputs/Test.app')).map((e) => [
      e.path,
      e.kind === 'symlink'
        ? { kind: 'symlink' as const, target: e.target ?? '', mode: e.mode }
        : {
            kind: 'file' as const,
            data: e.data ?? new Uint8Array(),
            mode: e.mode
          }
    ])
  )
  const entitlementsFor = (kind: string) => {
    const file = ENTITLEMENTS_BY_KIND.get(kind)
    if (!file) return undefined
    const bytes = new Uint8Array(readFileSync(join(FIXTURES, file)))
    const dict = parsePlist(bytes)

    return isPlistDict(dict) ? { bytes, dict } : undefined
  }
  await signBundle(
    tree,
    {
      configFor: (bundle) =>
        compact({
          signing: {
            kind: 'identity' as const,
            identity: { certificate, chain, privateKey },
            teamId
          },
          entitlements: entitlementsFor(bundle.kind)
        })
    },
    { hasher: createHasher(), logger: silentLogger, clock: systemClock }
  )

  // 5. compare every executable: all blobs byte-for-byte except the CMS, CMS structurally
  for (const path of [
    'Test',
    'PlugIns/Ext.appex/Ext',
    'Frameworks/Lib.framework/Lib',
    'Frameworks/libloose.dylib'
  ]) {
    const ours = (tree.get(path) as { data: Uint8Array }).data
    const apple = new Uint8Array(readFileSync(join(appleApp, path)))
    const blobsOf = (bytes: Uint8Array) => {
      const slice = parseMachO(bytes).slices[0]
      const sig = slice?.codeSignature
      if (!slice || !sig) throw new Error(`${path} unsigned`)
      return {
        slice,
        blobs: parseSuperBlob(
          slice.bytes.subarray(sig.dataoff, sig.dataoff + sig.datasize)
        )
      }
    }
    const a = blobsOf(apple)
    const o = blobsOf(ours)
    check(
      `${path}: same slot layout`,
      a.blobs.map((b) => b.slot).join() === o.blobs.map((b) => b.slot).join()
    )
    // true when the CodeDirectory differs only in the CodeResources hash (expected for the main app)
    let cdDiffersOnlyInResources = false
    for (const blob of a.blobs.filter((b) => b.slot !== CSSLOT_SIGNATURESLOT)) {
      const mine = o.blobs.find((b) => b.slot === blob.slot)
      const same = !!mine && toHex(mine.blob) === toHex(blob.blob)
      const isCodeDirectory =
        blob.slot === 0 || (blob.slot >= 0x1000 && blob.slot < 0x1005)
      if (!same && mine && isCodeDirectory) {
        // Only the CodeResources slot (−3) may differ: it hashes nested binaries whose CMS carries a
        // different signing time. Anything else is a real mismatch.
        const slots = differingHashSlots(blob.blob, mine.blob)
        const onlyResources = slots.length === 1 && slots[0] === 'special -3'
        cdDiffersOnlyInResources ||= onlyResources
        check(
          `${path}: slot 0x${blob.slot.toString(16)} identical except CodeResources hash`,
          onlyResources,
          `differs in: ${slots.join(', ') || 'header'}`
        )
        continue
      }
      check(`${path}: slot 0x${blob.slot.toString(16)} identical`, same)
    }
    const cmsText = (blobs: typeof a.blobs, name: string): string => {
      const cms =
        blobs.find((b) => b.slot === CSSLOT_SIGNATURESLOT)?.blob.subarray(8) ??
        new Uint8Array()
      const file = join(work, `${name}.cms`)
      writeFileSync(file, cms)
      const text = run('openssl', [
        'cms',
        '-cmsout',
        '-print',
        '-inform',
        'DER',
        '-in',
        file
      ]).replace(/UTCTIME:.*|GENERALIZEDTIME:.*/g, '<time>')
      const masked = maskSignatures(text)
      if (!cdDiffersOnlyInResources) return masked
      // The CD's own hash legitimately differs, so mask the three values derived from it (checked
      // separately for self-consistency below): messageDigest, cdhashes2 and the cdhashes plist.
      return masked
        .replace(
          /(object: messageDigest[^\n]*\n\s*set:\n\s*OCTET STRING:\n)((?:\s+[0-9a-f]{4} - [^\n]*\n)+)/,
          '$1<cd digest>\n'
        )
        .replace(/\[HEX DUMP\]:[0-9A-F]{40,64}/g, '[HEX DUMP]:<cd digest>')
        .replace(
          /(object: undefined \(1\.2\.840\.113635\.100\.9\.1\)\n\s*set:\n\s*OCTET STRING:\n)((?:\s+[0-9a-f]{4} - [^\n]*\n)+)/,
          (_m, head: string, body: string) =>
            `${head}<cdhashes plist, ${body.split('\n').length} lines>\n`
        )
    }
    const appleCms = cmsText(a.blobs, `apple-${path.replaceAll('/', '_')}`)
    const ourCms = cmsText(o.blobs, `ours-${path.replaceAll('/', '_')}`)
    check(
      `${path}: CMS structure identical (time/signature${cdDiffersOnlyInResources ? '/cd-derived hashes' : ''} masked)`,
      appleCms === ourCms
    )
    if (cdDiffersOnlyInResources) {
      const primary =
        o.blobs.find((b) => b.slot === 0)?.blob ?? new Uint8Array()
      const cms =
        o.blobs
          .find((b) => b.slot === CSSLOT_SIGNATURESLOT)
          ?.blob.subarray(8) ?? new Uint8Array()
      check(
        `${path}: CMS cd-derived hashes are correct for our CodeDirectory`,
        await cdAttributesConsistent(cms, primary)
      )
    }
    if (appleCms !== ourCms) {
      writeFileSync(
        join(work, `${path.replaceAll('/', '_')}.apple.txt`),
        appleCms
      )
      writeFileSync(join(work, `${path.replaceAll('/', '_')}.ours.txt`), ourCms)
    }
  }

  // 6. Apple accepts ours
  const oursApp = join(work, 'ours/Test.app')
  cpSync(join(FIXTURES, 'inputs/Test.app'), oursApp, {
    recursive: true,
    verbatimSymlinks: true
  })
  for (const [path, entry] of tree) {
    if (entry.kind !== 'file') continue
    mkdirSync(dirname(join(oursApp, path)), { recursive: true })
    writeFileSync(join(oursApp, path), entry.data)
  }
  const verify = spawnSync(
    'codesign',
    ['--verify', '--deep', '--strict', '-vv', oursApp],
    { encoding: 'utf8' }
  )
  check(
    "codesign --verify --deep --strict on Loadstar's output",
    verify.status === 0,
    verify.stderr.trim().split('\n').at(-1)
  )
} catch (error) {
  failures++
  report.push(`✗ ${(error as Error).message}`)
} finally {
  if (originalSearchList)
    spawnSync('security', [
      'list-keychains',
      '-d',
      'user',
      '-s',
      ...originalSearchList
    ])
  spawnSync('security', ['delete-keychain', keychain])
}

console.log(report.join('\n'))
console.log(
  failures === 0
    ? '\nAll checks passed.'
    : `\n${failures} check(s) failed. Artefacts kept in ${work}`
)
if (failures === 0) rmSync(work, { recursive: true, force: true })
process.exitCode = failures === 0 ? 0 : 1
