import type { Engine } from '@ipaforge/installer'
import type { Logger } from '@ipaforge/kernel'
import type { ChooseIpas, LogSource, ResolveIpa } from '@ipaforge/rpc'

export type MessageListener = (event: { readonly data: unknown }) => void

/** The part of Electron's `MessagePortMain` the transport uses. */
export type MainMessagePort = {
  postMessage(message: unknown): void
  on(event: 'message', listener: MessageListener): unknown
  on(event: 'close', listener: () => void): unknown
  off(event: 'message', listener: MessageListener): unknown
  off(event: 'close', listener: () => void): unknown
  /** Messages are queued until the port is started. */
  start(): void
  close(): void
}

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
  /** Served to the log viewer; without it the viewer is empty. */
  readonly logs?: LogSource
  /** The file dialog for this window's "Choose files…" (main process only). */
  readonly chooseIpas?: ChooseIpas
  readonly logger: Logger
  /** `() => new MessageChannelMain()` */
  readonly createChannel: () => ChannelPair<P>
}

/** The part of Electron's `dialog.showOpenDialog` the IPA chooser uses, already bound to the window. */
export type ChooseIpasDeps = {
  showOpenDialog(options: {
    readonly properties: readonly ('openFile' | 'multiSelections')[]
    readonly filters: readonly {
      readonly name: string
      readonly extensions: readonly string[]
    }[]
  }): Promise<{
    readonly canceled: boolean
    readonly filePaths: readonly string[]
  }>
}
