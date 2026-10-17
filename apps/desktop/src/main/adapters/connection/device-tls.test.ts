import { describe, expect, it } from 'vitest'

import { deviceTlsCiphers } from '@desktop/main/adapters/connection/device-tls.ts'

describe('deviceTlsCiphers', () => {
  it('lowers the OpenSSL security level when the TLS library accepts it (plain Node)', () => {
    expect(deviceTlsCiphers()).toEqual({ ciphers: 'DEFAULT:@SECLEVEL=0' })
  })

  it("uses the library's defaults when it refuses security levels (Electron's BoringSSL)", () => {
    const boringSsl = () => {
      throw Object.assign(new Error('INVALID_COMMAND'), {
        code: 'ERR_SSL_INVALID_COMMAND'
      })
    }

    expect(deviceTlsCiphers(boringSsl)).toEqual({})
  })
})
