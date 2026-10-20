// An update installs only if its file carries a Sigstore signature from IPAForge's release workflow for that very
// version: the release workflow signs every file it publishes (`cosign sign-blob`, keyless, with GitHub's OIDC
// identity), and the signature is checked here against Sigstore's public logs. A file changed after the release,
// or published by anything other than `release.yml` on the version's own tag, is refused.
import { Buffer } from 'node:buffer'
import { basename } from 'node:path'

import { verify } from 'sigstore'

import {
  RELEASE_WORKFLOW_IDENTITY,
  RELEASES_URL,
  SIGSTORE_ISSUER
} from '@desktop/main/updates/constants.ts'
import type {
  UpdateVerifier,
  UpdateVerifierDeps
} from '@desktop/main/updates/types.ts'

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
    )
    const bytes = await readFile(file)
    await verifyBundle(
      bundle as Parameters<typeof verify>[0],
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      {
        certificateIssuer: SIGSTORE_ISSUER,
        certificateIdentityURI: `${RELEASE_WORKFLOW_IDENTITY}@refs/tags/v${version}`,
        tufCachePath
      }
    )
  }
})
