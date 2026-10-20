import { describe, expect, it, vi } from 'vitest'

import { createSigstoreVerifier } from '@desktop/main/updates/sigstore-verifier.ts'

const VERSION = '0.1.0-alpha.99'
const FILE = `/cache/pending/IPAForge-${VERSION}-win-x64.exe`
const BUNDLE = { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' }

const setup = (verifyBundle = vi.fn(async () => ({}))) => {
  const fetchJson = vi.fn(async () => BUNDLE)
  const verifier = createSigstoreVerifier({
    fetchJson,
    readFile: async () => new Uint8Array([1, 2, 3]),
    tufCachePath: '/data/sigstore',
    verifyBundle: verifyBundle as never
  })

  return { verifier, fetchJson, verifyBundle }
}

describe('createSigstoreVerifier', () => {
  it("checks the file's signature from its release, for the release workflow on the version's own tag", async () => {
    const { verifier, fetchJson, verifyBundle } = setup()

    await verifier.verify(FILE, VERSION)

    expect(fetchJson).toHaveBeenCalledWith(
      `https://github.com/SirReaDy/ipaforge/releases/download/v${VERSION}/IPAForge-${VERSION}-win-x64.exe.sigstore.json`
    )
    expect(verifyBundle).toHaveBeenCalledWith(BUNDLE, Buffer.from([1, 2, 3]), {
      certificateIssuer: 'https://token.actions.githubusercontent.com',
      certificateIdentityURI: `https://github.com/SirReaDy/ipaforge/.github/workflows/release.yml@refs/tags/v${VERSION}`,
      tufCachePath: '/data/sigstore'
    })
  })

  it('rejects when the signature does not verify', async () => {
    const { verifier } = setup(
      vi.fn(async () => {
        throw new Error('signature verification failed')
      })
    )

    await expect(verifier.verify(FILE, VERSION)).rejects.toThrow(
      'signature verification failed'
    )
  })

  it('rejects when the release has no signature for the file', async () => {
    const verifier = createSigstoreVerifier({
      fetchJson: async () => {
        throw new Error('answered 404')
      },
      readFile: async () => new Uint8Array(),
      tufCachePath: '/data/sigstore'
    })

    await expect(verifier.verify(FILE, VERSION)).rejects.toThrow('404')
  })
})
