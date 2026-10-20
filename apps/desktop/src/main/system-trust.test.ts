import { getCACertificates } from 'node:tls'

import { describe, expect, it } from 'vitest'

import { systemCertificates } from '@desktop/main/adapters/http/trusted-roots.ts'
import { trustSystemCertificates } from '@desktop/main/system-trust.ts'
import { silentLogger } from '@ipaforge/kernel'

/** A certificate's base64 alone: Node gives them back re-encoded (other line lengths, a final newline). */
const pem = (certificate: string) =>
  certificate.replaceAll(/-----[A-Z ]+-----|\s/g, '')

describe('trustSystemCertificates', () => {
  it("adds the OS's certificates to Node's default trust, keeping the ones it had", () => {
    const before = getCACertificates('default')

    trustSystemCertificates(silentLogger)

    const trusted = new Set(getCACertificates('default').map(pem))
    expect(
      before.filter((certificate) => !trusted.has(pem(certificate)))
    ).toEqual([])
    expect(
      systemCertificates().filter(
        (certificate) => !trusted.has(pem(certificate))
      )
    ).toEqual([])
  })
})
