// Serves the update state to a window, like the Engine: on every page load a fresh MessageChannelMain, the state
// on one end and the other end posted to the page (the preload forwards it to the UI).
import { messagePortTransport } from '@desktop/main/rpc/message-port-transport.ts'
import type { ChannelPair, RendererContents } from '@desktop/main/rpc/types.ts'
import { UPDATES_PORT_CHANNEL } from '@desktop/shared/updates-channel.ts'
import { serveUpdates, type UpdateSource } from '@ipaforge/rpc'

export const serveUpdateState = <P>(
  contents: RendererContents<P>,
  source: UpdateSource,
  createChannel: () => ChannelPair<P>
): void => {
  let stop: (() => void) | undefined

  const connect = (): void => {
    stop?.()
    const { port1, port2 } = createChannel()
    const transport = messagePortTransport(port1)
    const unserve = serveUpdates(source, transport)
    stop = () => {
      unserve()
      transport.close()
    }
    contents.postMessage(UPDATES_PORT_CHANNEL, null, [port2])
  }

  contents.on('did-finish-load', connect)
  contents.on('destroyed', () => stop?.())
}
