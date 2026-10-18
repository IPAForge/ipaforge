import { describe, expect, it } from 'vitest'

import { bytesFileSource } from '@ipaforge/kernel'
import { createFakeEngine } from '@rpc/__tests__/fake-engine.ts'
import { createEngineClient } from '@rpc/application/client.ts'
import { createRpcServer } from '@rpc/application/server.ts'
import type { ChooseIpas } from '@rpc/domain/ports/choose-ipas.ts'
import { createMemoryTransportPair } from '@rpc/infrastructure/memory-transport.ts'

const setup = (chooseIpas?: ChooseIpas) => {
  const [serverEnd, clientEnd] = createMemoryTransportPair()
  createRpcServer({
    engine: createFakeEngine().engine,
    transport: serverEnd,
    resolveIpa: async () => bytesFileSource('app.ipa', new Uint8Array()),
    ...(chooseIpas ? { chooseIpas } : {})
  })

  return createEngineClient(clientEnd)
}

describe('engine.chooseIpas', () => {
  it("answers with the files the host's dialog picked", async () => {
    const picked = [{ path: '/Users/me/Game.ipa', name: 'Game.ipa', size: 42 }]
    const client = setup(async () => picked)

    expect(await client.chooseIpas()).toEqual(picked)
  })

  it('answers with none when the host has no dialog', async () => {
    expect(await setup().chooseIpas()).toEqual([])
  })
})
