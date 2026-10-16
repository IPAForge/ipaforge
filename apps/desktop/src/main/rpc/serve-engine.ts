// Serves the Engine to a window: on every page load a fresh MessageChannelMain, the rpc server on one end and the
// other end posted to the page (the preload forwards it to the UI). A reload drops the old channel, which cancels
// its runs. Electron's types fit the structural ones here, so this is tested without Electron.
import {
  type MainMessagePort,
  messagePortTransport
} from '@desktop/main/rpc/message-port-transport.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'
import type { Engine } from '@loadstar/installer'
import type { Logger } from '@loadstar/kernel'
import { createRpcServer, type ResolveIpa, type RpcServer } from '@loadstar/rpc'

export type ChannelPair<P> = {
  readonly port1: MainMessagePort
  readonly port2: P
}

/** The part of Electron's `WebContents` this uses. */
export type RendererContents<P> = {
  postMessage(channel: string, message: unknown, transfer: P[]): void
  on(event: 'did-finish-load' | 'destroyed', listener: () => void): unknown
}

export type ServeEngineDeps<P> = {
  readonly engine: Engine
  readonly resolveIpa: ResolveIpa
  readonly logger: Logger
  /** `() => new MessageChannelMain()` */
  readonly createChannel: () => ChannelPair<P>
}

export const serveEngine = <P>(
  contents: RendererContents<P>,
  { engine, resolveIpa, logger, createChannel }: ServeEngineDeps<P>
): void => {
  let server: RpcServer | undefined

  const connect = (): void => {
    server?.close()
    const { port1, port2 } = createChannel()
    server = createRpcServer({
      engine,
      transport: messagePortTransport(port1),
      resolveIpa,
      logger
    })
    contents.postMessage(RPC_PORT_CHANNEL, null, [port2])
    logger.info('engine connected to the renderer')
  }

  contents.on('did-finish-load', connect)
  contents.on('destroyed', () => server?.close())
}
