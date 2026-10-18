import { describe, expect, it } from 'vitest'

import { certificateFor, memorySecrets } from '@installer/__tests__/fakes.ts'
import {
  certificateKey,
  createCertificateStore
} from '@installer/application/certificate-store.ts'
import { silentLogger, utf8Encode } from '@ipaforge/kernel'

describe('certificate store', () => {
  it('keeps a certificate and its key per account and team', async () => {
    const secrets = memorySecrets()
    const store = createCertificateStore(secrets, silentLogger)
    const certificate = {
      ...certificateFor('ABC'),
      expiresAt: new Date('2027-01-01T00:00:00Z')
    }
    await store.save('me', 'TEAM', {
      certificate,
      privateKey: new Uint8Array([9, 8, 7])
    })

    expect(await store.load('me', 'TEAM')).toEqual({
      certificate,
      privateKey: new Uint8Array([9, 8, 7])
    })
    expect(await store.load('me', 'OTHER')).toBeUndefined()
  })

  it('treats an unreadable entry as missing', async () => {
    const secrets = memorySecrets()
    await secrets.set(certificateKey('me', 'TEAM'), utf8Encode('{not json'))
    expect(
      await createCertificateStore(secrets, silentLogger).load('me', 'TEAM')
    ).toBeUndefined()
  })
})
