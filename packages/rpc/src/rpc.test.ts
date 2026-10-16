import { describe, expect, it, vi } from 'vitest'

import type { DeviceWatchEvent, RunEvent } from '@loadstar/installer'
import { bytesFileSource, ErrorCode, LoadstarError } from '@loadstar/kernel'
import {
  createFakeEngine,
  type FakeState,
  TEAMS
} from '@rpc/__tests__/fake-engine.ts'
import { createEngineClient } from '@rpc/application/client.ts'
import { createRpcServer } from '@rpc/application/server.ts'
import type { RemoteRunHandle } from '@rpc/domain/engine-client.ts'
import type { ExternalIpa } from '@rpc/domain/protocol/inputs.ts'
import type { Wire } from '@rpc/domain/wire.ts'
import { createMemoryTransportPair } from '@rpc/infrastructure/memory-transport.ts'

const IPA_BYTES = new Uint8Array([1, 2, 3, 4])
const ACCOUNT = { udid: 'UDID1', accountId: 'acct' }
const FILE_APP = { kind: 'file', path: '/picked/My App.ipa' } as const

const setup = () => {
  const [serverEnd, clientEnd] = createMemoryTransportPair()
  const { engine, control } = createFakeEngine()
  const resolveIpa = vi.fn(async (ipa: ExternalIpa) =>
    bytesFileSource(
      ipa.kind === 'file' ? 'My App.ipa' : 'download.ipa',
      IPA_BYTES
    )
  )
  const server = createRpcServer({ engine, transport: serverEnd, resolveIpa })
  const client = createEngineClient(clientEnd)

  return { client, server, control, resolveIpa, serverEnd, clientEnd }
}

/** Resolves when the run asks its next question. */
const nextPrompt = <S>(handle: RemoteRunHandle<S>) =>
  new Promise<void>((resolve) => {
    const stop = handle.subscribe((event) => {
      if (event.type !== 'prompt') return
      queueMicrotask(() => stop())
      resolve()
    })
  })

const installApps = (
  client: ReturnType<typeof setup>['client'],
  options?: Parameters<typeof client.installApps>[1]
) => client.installApps({ ...ACCOUNT, apps: [FILE_APP] }, options)

/** A raw peer: what the other side sent, and a way to send anything back. */
const rawPeer = (end: ReturnType<typeof createMemoryTransportPair>[number]) => {
  const received: Record<string, unknown>[] = []
  end.onMessage((message) => received.push(message as Record<string, unknown>))
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  return { received, send: end.send, settle }
}

describe('queries', () => {
  it("answers queries with the Engine's values, Dates included", async () => {
    const { client } = setup()
    expect(await client.listDevices()).toEqual([
      { udid: 'UDID1', connection: 'USB' }
    ])
    expect(await client.listTeams('acct')).toEqual(TEAMS)
    expect(await client.recommendedChannel('sidestore', '26.4')).toBe('nightly')
    expect(await client.appIdQuota({ accountId: 'acct' })).toEqual({
      query: { accountId: 'acct' }
    })
    const { certificates } = await client.listCertificates({
      accountId: 'acct'
    })
    expect(certificates[0]?.expiresAt).toBeInstanceOf(Date)
  })

  it('resolves a named IPA on the server; catalog apps stay catalog sources', async () => {
    const { client, control, resolveIpa } = setup()
    await client.planInstall({ ...ACCOUNT, source: FILE_APP })
    await client.planInstall({
      ...ACCOUNT,
      source: { kind: 'catalog', appId: 'sidestore' }
    })

    expect(resolveIpa).toHaveBeenCalledTimes(1)
    expect(resolveIpa.mock.calls[0]?.[0]).toEqual(FILE_APP)
    const [file, catalog] = control.planned as {
      source: { kind: string; file?: { name: string } }
    }[]
    expect(file?.source.file?.name).toBe('My App.ipa')
    expect(catalog?.source).toEqual({ kind: 'catalog', appId: 'sidestore' })
  })

  it('brings errors back as LoadstarErrors with code, data and cause', async () => {
    const { client } = setup()
    const error = await client
      .deviceStatus('UDID1')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(LoadstarError)
    expect(error).toMatchObject({
      code: ErrorCode.DeviceLocked,
      data: { udid: 'UDID1' }
    })
    expect((error as LoadstarError).cause).toMatchObject({
      code: ErrorCode.Offline,
      message: 'lockdown went away'
    })
    expect(client.classify(error).code).toBe(ErrorCode.DeviceLocked)
  })

  it('refuses an IPA URL that is not HTTPS', async () => {
    const { client } = setup()
    await expect(
      client.planInstall({
        ...ACCOUNT,
        source: { kind: 'url', url: 'http://example.com/a.ipa' }
      })
    ).rejects.toMatchObject({ code: ErrorCode.InvalidRpcMessage })
  })
})

describe('runs', () => {
  it('streams events and a prompt, takes the answer and ends with the state, without file handles', async () => {
    const { client } = setup()
    const handle = installApps(client)
    const events: string[] = []
    handle.subscribe((event) => events.push(event.type))

    await nextPrompt(handle)
    expect(handle.pending()).toEqual({
      kind: 'apple.choose_team',
      data: { teams: TEAMS }
    })
    handle.answer('TEAM1')
    expect(handle.pending()).toBeUndefined()

    const result = await handle.result
    expect(result.status).toBe('completed')
    const state = (result as unknown as { state: Wire<FakeState> }).state
    expect(state).toMatchObject({
      prepared: true,
      teamId: 'TEAM1',
      installed: true
    })
    expect(state.apps[0]).toEqual({
      kind: 'file',
      file: { name: 'My App.ipa', size: IPA_BYTES.length }
    })
    expect(events).toContain('step-progress')
    expect(events).toContain('prompt')
    expect(events.at(-1)).toBe('progress')

    const replayed: string[] = []
    handle.subscribe((event) => replayed.push(event.type))
    expect(replayed).toEqual(events)
  })

  it('starts a sign-in with the Apple ID only, announcing its steps first', async () => {
    const { client, control } = setup()
    const handle = client.signIn({ appleId: 'someone@example.com' })
    const events: RunEvent[] = []
    handle.subscribe((event) => events.push(event))
    await nextPrompt(handle)
    handle.cancel()
    await handle.result

    expect(control.signIns).toEqual([{ appleId: 'someone@example.com' }])
    expect(events[0]).toEqual({
      type: 'run-started',
      pipelineId: 'fake.install',
      steps: [
        { stepId: 'prepare', labelKey: 'step.prepare' },
        { stepId: 'choose-team', labelKey: 'step.team' },
        { stepId: 'install', labelKey: 'step.install' }
      ],
      completed: [],
      fraction: 0
    })
  })

  it('resolves every app of a preload, URLs included', async () => {
    const { client, control, resolveIpa } = setup()
    const url = { kind: 'url', url: 'https://example.com/a.ipa' } as const
    const handle = client.installApps({
      ...ACCOUNT,
      apps: [url, { kind: 'catalog', appId: 'sidestore' }]
    })
    await nextPrompt(handle)
    handle.cancel()
    await handle.result

    expect(resolveIpa.mock.calls.map(([ipa]) => ipa)).toEqual([url])
    expect(control.appInputs[0]?.apps.map((app) => app.kind)).toEqual([
      'file',
      'catalog'
    ])
  })

  it('refuses to answer when no question waits, like the Engine', () => {
    const { client } = setup()
    const handle = installApps(client)
    expect(() => handle.answer('TEAM1')).toThrow(
      expect.objectContaining({ code: ErrorCode.Unexpected })
    )
    handle.cancel()
  })

  it('declines: the run fails with installer.prompt_cancelled at that step', async () => {
    const { client } = setup()
    const handle = installApps(client)
    await nextPrompt(handle)
    handle.decline()

    const result = await handle.result
    expect(result).toMatchObject({
      status: 'failed',
      failedStep: 'choose-team'
    })
    expect(result.status === 'failed' && result.error).toMatchObject({
      code: ErrorCode.PromptCancelled
    })
  })

  it('cancels through the handle and through an AbortSignal', async () => {
    const { client } = setup()
    const handle = installApps(client)
    await nextPrompt(handle)
    handle.cancel()
    const result = await handle.result
    expect(result).toMatchObject({
      status: 'cancelled',
      checkpoint: { completed: ['prepare'] }
    })

    const controller = new AbortController()
    const aborted = installApps(client, { signal: controller.signal })
    await nextPrompt(aborted)
    controller.abort()
    expect((await aborted.result).status).toBe('cancelled')
  })

  it('resumes a failed run from its checkpoint, once', async () => {
    const { client, control } = setup()
    control.installFailures = 1
    const first = installApps(client)
    const failures: unknown[] = []
    first.subscribe(
      (event) => event.type === 'step-failed' && failures.push(event.error)
    )
    await nextPrompt(first)
    first.answer('TEAM1')

    const failed = await first.result
    if (failed.status !== 'failed')
      throw new Error(`expected a failure, got ${failed.status}`)
    expect(failed.error).toMatchObject({
      code: ErrorCode.InstallFailed,
      data: { bundleId: 'com.example.app' }
    })
    expect(failures[0]).toBeInstanceOf(LoadstarError)
    expect(failed.checkpoint).toMatchObject({
      pipelineId: 'fake.install',
      completed: ['prepare', 'choose-team']
    })

    const resumed = installApps(client, { resume: failed.checkpoint })
    const asked: string[] = []
    resumed.subscribe(
      (event) => event.type === 'prompt' && asked.push(event.request.kind)
    )
    expect(await resumed.result).toMatchObject({
      status: 'completed',
      state: { teamId: 'TEAM1', installed: true }
    })
    expect(asked).toEqual([])
    // The Engine resumed from its own state, file handle included.
    const resume = control.runs.at(-1)?.options.resume
    expect(
      typeof resume?.state.apps[0]?.kind === 'string' && resume.state.apps[0]
    ).toMatchObject({ kind: 'file' })

    await expect(
      installApps(client, { resume: failed.checkpoint }).result
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidRpcMessage
    })
  })

  it('will not resume a checkpoint with another command', async () => {
    const { client } = setup()
    const handle = installApps(client)
    await nextPrompt(handle)
    handle.cancel()
    const result = await handle.result
    if (result.status !== 'cancelled')
      throw new Error('expected a cancelled run')

    const other = client.installSideStore(
      { ...ACCOUNT, variant: 'sidestore' },
      { resume: result.checkpoint }
    )
    await expect(other.result).rejects.toMatchObject({
      code: ErrorCode.InvalidRpcMessage
    })
  })

  it('rejects the result when the command cannot start', async () => {
    const { client } = setup()
    await expect(client.placePairing(ACCOUNT).result).rejects.toMatchObject({
      code: ErrorCode.TeamRequired,
      data: { accountId: 'acct' }
    })
  })
})

describe('device watch', () => {
  const IPAD = {
    udid: 'UDID2',
    deviceId: 2,
    connectionType: 'network' as const
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('streams the list, then attach and detach events, until unsubscribed', async () => {
    const { client, control } = setup()
    const events: DeviceWatchEvent[] = []
    const stop = client.watchDevices((event) => events.push(event))
    await vi.waitFor(() => expect(events).toHaveLength(1))
    expect(events[0]).toEqual({
      type: 'devices',
      devices: [{ udid: 'UDID1', deviceId: 1, connectionType: 'usb' }]
    })

    for (const watcher of control.watchers) {
      watcher({ type: 'attached', device: IPAD })
      watcher({ type: 'detached', deviceId: 1 })
    }
    await vi.waitFor(() => expect(events).toHaveLength(3))
    expect(events[1]).toEqual({ type: 'attached', device: IPAD })
    expect(events[2]).toEqual({ type: 'detached', deviceId: 1 })

    stop()
    await vi.waitFor(() => expect(control.watchers.size).toBe(0))
    stop()
    await settle()
    expect(events).toHaveLength(3)
  })

  it('ends the Engine subscription when the channel closes', async () => {
    const { client, control, clientEnd } = setup()
    client.watchDevices(() => {})
    await vi.waitFor(() => expect(control.watchers.size).toBe(1))
    clientEnd.close()
    await vi.waitFor(() => expect(control.watchers.size).toBe(0))
  })

  it('refuses a subscription id already in use, and an event that fails validation', async () => {
    const [serverEnd, clientEnd] = createMemoryTransportPair()
    const { engine, control } = createFakeEngine()
    createRpcServer({ engine, transport: serverEnd, resolveIpa: vi.fn() })
    const peer = rawPeer(clientEnd)
    const subscribe = {
      v: 1,
      type: 'subscribe',
      subscriptionId: 's1',
      topic: 'devices'
    }
    peer.send({ ...subscribe, id: 'a' })
    peer.send({ ...subscribe, id: 'b' })
    peer.send({ ...subscribe, id: 'c', subscriptionId: 's2', topic: 'apps' })
    await vi.waitFor(() =>
      expect(peer.received.length).toBeGreaterThanOrEqual(4)
    )

    const errors = peer.received.filter((message) => message.type === 'error')
    expect(errors.map((message) => message.id).sort()).toEqual(['b', 'c'])
    expect(control.watchers.size).toBe(1)
  })
})

describe('invalid messages', () => {
  it('server: answers malformed requests with rpc.invalid_message and never throws', async () => {
    const [serverEnd, clientEnd] = createMemoryTransportPair()
    const warn = vi.fn()
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn,
      error: vi.fn(),
      child: () => logger
    }
    createRpcServer({
      engine: createFakeEngine().engine,
      transport: serverEnd,
      resolveIpa: vi.fn(),
      logger
    })
    const peer = rawPeer(clientEnd)

    peer.send({
      v: 1,
      id: 'a',
      type: 'query',
      call: { method: 'deleteEverything', args: [] }
    })
    peer.send({
      v: 2,
      id: 'b',
      type: 'query',
      call: { method: 'listDevices', args: [] }
    })
    peer.send({
      v: 1,
      id: 'c',
      type: 'answer',
      runId: 'no-such-run',
      answer: 'x'
    })
    peer.send({ v: 1, type: 'query' })
    peer.send('garbage')
    await peer.settle()

    expect(peer.received.map((message) => [message.id, message.type])).toEqual([
      ['a', 'error'],
      ['b', 'error'],
      ['c', 'error']
    ])
    for (const message of peer.received) {
      expect(message.error).toMatchObject({ code: ErrorCode.InvalidRpcMessage })
    }
    expect(warn).toHaveBeenCalledTimes(4)
  })

  it('client: a malformed response rejects its request; one without an id is dropped', async () => {
    const [serverEnd, clientEnd] = createMemoryTransportPair()
    const client = createEngineClient(clientEnd)
    const peer = rawPeer(serverEnd)

    const devices = client.listDevices()
    await peer.settle()
    const id = peer.received[0]?.id
    peer.send({ v: 1, type: 'response', value: [] })
    peer.send({ v: 1, id, type: 'surprise' })

    await expect(devices).rejects.toMatchObject({
      code: ErrorCode.InvalidRpcMessage
    })
  })

  it('client: an unknown error code is invalid, not trusted', async () => {
    const [serverEnd, clientEnd] = createMemoryTransportPair()
    const client = createEngineClient(clientEnd)
    const peer = rawPeer(serverEnd)

    const devices = client.listDevices()
    await peer.settle()
    peer.send({
      v: 1,
      id: peer.received[0]?.id,
      type: 'error',
      error: { name: 'x', message: 'y', code: 'made.up' }
    })

    await expect(devices).rejects.toMatchObject({
      code: ErrorCode.InvalidRpcMessage
    })
  })
})

describe('closing the channel', () => {
  it('rejects pending requests and runs with rpc.disconnected, and every later request', async () => {
    const [serverEnd, clientEnd] = createMemoryTransportPair()
    const client = createEngineClient(clientEnd)
    const peer = rawPeer(serverEnd)

    const devices = client.listDevices()
    const run = installApps(client)
    await peer.settle()
    serverEnd.close()

    await expect(devices).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
    await expect(run.result).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
    await expect(client.listAccounts()).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
  })

  it('times out a request the other side never answers', async () => {
    const [, clientEnd] = createMemoryTransportPair()
    const client = createEngineClient(clientEnd, {
      config: { requestTimeoutMs: 10 }
    })
    await expect(client.listDevices()).rejects.toMatchObject({
      code: ErrorCode.RpcTimeout,
      data: { timeoutMs: 10 }
    })
  })

  it('server: cancels its runs when the UI goes away', async () => {
    const { client, control, clientEnd } = setup()
    const handle = installApps(client)
    await nextPrompt(handle)
    clientEnd.close()

    await expect(handle.result).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
    expect((await control.runs[0]?.handle.result)?.status).toBe('cancelled')
  })

  it('server: close cancels runs and closes the channel', async () => {
    const { client, control, server } = setup()
    const handle = installApps(client)
    await nextPrompt(handle)
    server.close()

    await expect(handle.result).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
    expect((await control.runs[0]?.handle.result)?.status).toBe('cancelled')
  })
})
