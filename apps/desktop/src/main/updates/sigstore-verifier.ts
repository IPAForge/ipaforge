// An update installs only if its file carries a Sigstore signature from IPAForge's release workflow (under the
// repository's current name or its earlier one) for that very version: the release workflow signs every file it publishes (`cosign sign-blob`, keyless, with GitHub's OIDC
// identity), and the signature is checked here against Sigstore's public logs. A file changed after the release,
// or published by anything other than `release.yml` on the version's own tag, is refused.
import { Buffer } from 'node:buffer'
import { basename } from 'node:path'

import { verify } from 'sigstore'

import {
  RELEASE_WORKFLOWS,
  RELEASES_URL,
  SIGSTORE_ISSUER,
  UNTRUSTED_SIGNER
} from '@desktop/main/updates/constants.ts'
import type {
  UpdateVerifier,
  UpdateVerifierDeps
} from '@desktop/main/updates/types.ts'

const isUntrustedSigner = (error: unknown): boolean =>
  (error as { code?: unknown } | undefined)?.code === UNTRUSTED_SIGNER

export const createSigstoreVerifier = ({
  fetchJson,
  readFile,
  tufCachePath,
  verifyBundle = verify
}: UpdateVerifierDeps): UpdateVerifier => ({
  verify: async (file, version) => {
    const name = basename(file)
    const bundle = await fetchJson(
      `${RELEASES_URL}/download/v${version}/${name}.sigstore.json`
    ).catch((error: unknown) => {
      throw new Error(`No signature for ${name} in the ${version} release`, {
        cause: error
      })
    })
    const bytes = await readFile(file)
    const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    // Each workflow in turn: only "signed by someone else" moves on to the next; any other failure is final.
    const verifyAs = async (workflows: readonly string[]): Promise<void> => {
      const [workflow, ...others] = workflows
      if (!workflow) return
      try {
        await verifyBundle(bundle as Parameters<typeof verify>[0], data, {
          certificateIssuer: SIGSTORE_ISSUER,
          certificateIdentityURI: `${workflow}@refs/tags/v${version}`,
          tufCachePath
        })
      } catch (error) {
        if (others.length === 0 || !isUntrustedSigner(error)) throw error
        await verifyAs(others)
      }
    }

    await verifyAs(RELEASE_WORKFLOWS)
  }
})
