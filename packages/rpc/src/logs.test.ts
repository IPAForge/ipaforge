import { describe, expect, it, vi } from 'vitest'

import {
  bytesFileSource,
  createLogBuffer,
  createLogger,
  createLogLevel,
  ErrorCode,
  type LogEntry,
  type LogRecord
} from '@ipaforge/kernel'
import { createFakeEngine } from '@rpc/__tests__/fake-engine.ts'
import { createEngineClient } from '@rpc/application/client.ts'
import { createRpcServer } from '@rpc/application/server.ts'
import { createMemoryTransportPair } from '@rpc/infrastructure/memory-transport.ts'

const resolveIpa = async () => bytesFileSource('app.ipa', new Uint8Array())

const setup = ({ withLogs = true } = {}) => {
  const [serverEnd, clientEnd] = createMemoryTransportPair()
  const buffer = createLogBuffer()
  const level = createLogLevel('info')
  const logger = createLogger({ level: level.get, sink: buffer.sink })
  createRpcServer({
    engine: createFakeEngine().engine,
    transport: serverEnd,
    resolveIpa,
    logger,
    ...(withLogs ? { logs: { buffer, level } } : {})
  })

  return { client: createEngineClient(clientEnd), logger, buffer, serverEnd }
}

const record = (level: LogRecord['level'], msg: string): LogRecord => ({
  ts: '2026-10-18T14:00:00.000Z',
  level,
  scope: 'ui.router',
  msg,
  fields: { to: '/logs' }
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('engine.logs', () => {
  it('pages through the buffer with the filters applied on the Engine side', async () => {
    const { client, logger } = setup()
    for (let index = 0; index < 5; index++)
      logger.child({ scope: 'device' }).info('status', { index })
    logger.child({ scope: 'apple' }).warn('anisette slow')

    const newest = await client.logs.page({ scopes: ['device'], limit: 2 })
    expect(newest.entries.map((e) => e.fields.index)).toEqual([3, 4])
    expect(newest.hasMore).toBe(true)
    const older = await client.logs.page({
      scopes: ['device'],
      before: newest.entries[0]?.seq ?? 0
    })
    expect(older.entries.map((e) => e.fields.index)).toEqual([0, 1, 2])
    expect(older.hasMore).toBe(false)

    const found = await client.logs.page({ text: 'ANISETTE' })
    expect(found.entries.map((e) => e.msg)).toEqual(['anisette slow'])
    expect((await client.logs.page({ minLevel: 'warn' })).counts).toEqual({
      debug: 0,
      info: 5,
      warn: 1,
      error: 0
    })
  })

  it('streams new entries until the viewer stops watching', async () => {
    const { client, logger } = setup()
    const seen: LogEntry[] = []
    const stop = client.logs.watch((entry) => seen.push(entry))
    await settle()
    logger.info('first', { udid: 'secret-udid' })
    await settle()
    stop()
    await settle()
    logger.info('second')
    await settle()
    expect(seen.map((e) => e.msg)).toEqual(['first'])
    expect(seen[0]?.fields.udid).toBe('[redacted]')
  })

  it('changes the level the Engine records at', async () => {
    const { client, logger } = setup()
    expect(await client.logs.level()).toBe('info')
    logger.debug('before')
    await client.logs.setLevel('debug')
    expect(await client.logs.level()).toBe('debug')
    logger.debug('after')
    const { entries } = await client.logs.page()
    expect(entries.map((e) => e.msg)).toEqual(['after'])
  })

  it("keeps the UI's records at or above the level", async () => {
    const { client } = setup()
    client.logs.write(record('debug', 'dropped'))
    client.logs.write(record('info', 'kept'))
    await settle()
    const { entries } = await client.logs.page()
    expect(entries.map((e) => [e.scope, e.msg])).toEqual([
      ['ui.router', 'kept']
    ])
  })

  it('answers with nothing when the host keeps no logs', async () => {
    const { client } = setup({ withLogs: false })
    client.logs.write(record('error', 'nowhere'))
    expect(await client.logs.page()).toEqual({
      entries: [],
      hasMore: false,
      counts: { debug: 0, info: 0, warn: 0, error: 0 }
    })
    expect(await client.logs.level()).toBe('info')
  })

  it('refuses a page bigger than the buffer allows', async () => {
    const { client } = setup()
    await expect(client.logs.page({ limit: 50_000 })).rejects.toMatchObject({
      code: ErrorCode.InvalidRpcMessage
    })
  })

  it('never logs a log entry that failed to send, so it cannot loop', async () => {
    const { client, logger, buffer, serverEnd } = setup()
    client.logs.watch(() => {})
    await settle()
    const send = vi.spyOn(serverEnd, 'send').mockImplementation(() => {
      throw new Error('channel gone')
    })
    logger.info('one entry')
    expect(send).toHaveBeenCalledTimes(1)
    expect(buffer.page().entries.map((e) => e.msg)).toEqual(['one entry'])
  })
})
