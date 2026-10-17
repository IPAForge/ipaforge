/** The part of Electron's `ipcRenderer` this uses. */
export type PortReceiver = {
  on(
    channel: string,
    listener: (event: { readonly ports: readonly MessagePort[] }) => void
  ): unknown
}

/** The part of the page's `window` this uses. */
export type PortTarget = {
  postMessage(
    message: unknown,
    targetOrigin: string,
    transfer: Transferable[]
  ): void
}
