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

const ORG = 'https://github.com/IPAForge/ipaforge/.github/workflows/release.yml'
const OLD = 'https://github.com/SirReaDy/ipaforge/.github/workflows/release.yml'

/** sigstore-js's error for a valid signature made by another workflow. */
const untrusted = () =>
  Object.assign(new Error('certificate identity error'), {
    code: 'UNTRUSTED_SIGNER_ERROR'
  })

describe('createSigstoreVerifier', () => {
  it("checks the file's signature from its release, for the release workflow on the version's own tag", async () => {
    const { verifier, fetchJson, verifyBundle } = setup()

    await verifier.verify(FILE, VERSION)

    expect(fetchJson).toHaveBeenCalledWith(
      `https://github.com/IPAForge/ipaforge/releases/download/v${VERSION}/IPAForge-${VERSION}-win-x64.exe.sigstore.json`
    )
    expect(verifyBundle).toHaveBeenCalledWith(BUNDLE, Buffer.from([1, 2, 3]), {
      certificateIssuer: 'https://token.actions.githubusercontent.com',
      certificateIdentityURI: `${ORG}@refs/tags/v${VERSION}`,
      tufCachePath: '/data/sigstore'
    })
  })

  it('accepts a release made before the move to the organization', async () => {
    const verifyBundle = vi
      .fn()
      .mockRejectedValueOnce(untrusted())
      .mockResolvedValueOnce({})
    const { verifier } = setup(verifyBundle)

    await verifier.verify(FILE, VERSION)

    expect(
      verifyBundle.mock.calls.map(
        ([, , options]) =>
          (options as { certificateIdentityURI: string }).certificateIdentityURI
      )
    ).toEqual([`${ORG}@refs/tags/v${VERSION}`, `${OLD}@refs/tags/v${VERSION}`])
  })

  it('refuses a signature made by any other workflow', async () => {
    const verifyBundle = vi.fn(async () => {
      throw untrusted()
    })
    const { verifier } = setup(verifyBundle)

    await expect(verifier.verify(FILE, VERSION)).rejects.toThrow(
      'certificate identity error'
    )
    expect(verifyBundle).toHaveBeenCalledTimes(2)
  })

  it('rejects a broken signature at once, without trying the other workflow', async () => {
    const verifyBundle = vi.fn(async () => {
      throw new Error('signature verification failed')
    })
    const { verifier } = setup(verifyBundle)

    await expect(verifier.verify(FILE, VERSION)).rejects.toThrow(
      'signature verification failed'
    )
    expect(verifyBundle).toHaveBeenCalledOnce()
  })

  it('rejects when the release has no signature for the file', async () => {
    const verifier = createSigstoreVerifier({
      fetchJson: async () => {
        throw new Error('answered 404')
      },
      readFile: async () => new Uint8Array(),
      tufCachePath: '/data/sigstore'
    })

    await expect(verifier.verify(FILE, VERSION)).rejects.toThrow(
      `No signature for IPAForge-${VERSION}-win-x64.exe in the ${VERSION} release`
    )
  })
})
