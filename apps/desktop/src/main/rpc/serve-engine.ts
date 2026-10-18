// Serves the Engine to a window: on every page load a fresh MessageChannelMain, the rpc server on one end and the
// other end posted to the page (the preload forwards it to the UI). A reload drops the old channel, which cancels
// its runs. Electron's types fit the structural ones here, so this is tested without Electron.
import { messagePortTransport } from '@desktop/main/rpc/message-port-transport.ts'
import type {
  RendererContents,
  ServeEngineDeps
} from '@desktop/main/rpc/types.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'
import { createRpcServer, type RpcServer } from '@ipaforge/rpc'

export const serveEngine = <P>(
  contents: RendererContents<P>,
  { engine, resolveIpa, logs, logger, createChannel }: ServeEngineDeps<P>
): void => {
  let server: RpcServer | undefined

  const connect = (): void => {
    server?.close()
    const { port1, port2 } = createChannel()
    server = createRpcServer({
      engine,
      transport: messagePortTransport(port1),
      resolveIpa,
      logger,
      ...(logs ? { logs } : {})
    })
    contents.postMessage(RPC_PORT_CHANNEL, null, [port2])
    logger.info('engine connected to the renderer')
  }

  contents.on('did-finish-load', connect)
  contents.on('destroyed', () => server?.close())
}
