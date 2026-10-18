import { describe, expect, it } from 'vitest'

import { causeChain } from '@desktop/probes/shared/errors.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

describe('causeChain', () => {
  it('lists every cause, outermost first, with Node error codes', () => {
    const socket = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET'
    })
    const tls = new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: 'TLS failed',
      cause: socket
    })
    const outer = new Error('open failed', { cause: tls })
    expect(causeChain(outer)).toEqual([
      '  caused by IPAForgeError: device.protocol_error: TLS failed',
      '  caused by Error: ECONNRESET: socket hang up'
    ])
  })

  it('is empty without a cause', () => {
    expect(causeChain(new Error('plain'))).toEqual([])
  })
})
