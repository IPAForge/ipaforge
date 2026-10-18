import { afterEach, describe, expect, it, vi } from 'vitest'

import { forwardRpcPort } from '@desktop/preload/forward-port.ts'
import { FILE_PATHS_GLOBAL } from '@desktop/shared/file-paths.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'

const electron = vi.hoisted(() => ({
  ipcRenderer: { on: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  webUtils: { getPathForFile: vi.fn(() => '/Users/me/Game.ipa') }
}))

vi.mock('electron', () => electron)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

type PortListener = (event: { ports: MessagePort[] }) => void

describe('forwardRpcPort', () => {
  it('posts the port main sends to the page, and nothing else', () => {
    const listeners = new Map<string, PortListener>()
    const ipc = {
      on: (channel: string, listener: PortListener) =>
        listeners.set(channel, listener)
    }
    const page = { postMessage: vi.fn() }
    forwardRpcPort(ipc, page)

    expect([...listeners.keys()]).toEqual([RPC_PORT_CHANNEL])
    const port = {} as MessagePort
    listeners.get(RPC_PORT_CHANNEL)?.({ ports: [port] })
    expect(page.postMessage).toHaveBeenCalledWith(RPC_PORT_CHANNEL, '*', [port])
  })
})

describe('the preload', () => {
  it('listens only for the rpc port, and gives the page one function: the path of a dropped file', async () => {
    vi.stubGlobal('postMessage', vi.fn())
    await import('@desktop/preload/index.ts')

    expect(electron.ipcRenderer.on).toHaveBeenCalledTimes(1)
    expect(electron.ipcRenderer.on.mock.calls[0]?.[0]).toBe(RPC_PORT_CHANNEL)
    expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1)
    const [key, api] = electron.contextBridge.exposeInMainWorld.mock
      .calls[0] as unknown as [
      string,
      Record<string, (file: unknown) => string>
    ]
    expect(key).toBe(FILE_PATHS_GLOBAL)
    expect(Object.keys(api)).toEqual(['pathOf'])
    const dropped = {}
    expect(api.pathOf?.(dropped)).toBe('/Users/me/Game.ipa')
    expect(electron.webUtils.getPathForFile).toHaveBeenCalledWith(dropped)
  })
})
