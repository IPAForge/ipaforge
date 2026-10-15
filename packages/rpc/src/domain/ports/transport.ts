/**
 * A message channel between the Engine side and the UI side (desktop: an Electron MessagePort; tests: an in-memory
 * pair). Messages are structured-clone values: plain objects, arrays, Maps, Dates and Uint8Arrays, no functions.
 */
export type Transport = {
  send(message: unknown): void
  /** Delivers each message from the other side until the returned function is called. */
  onMessage(listener: (message: unknown) => void): () => void
  /** Called once when either side closes the channel. */
  onClose(listener: () => void): () => void
  close(): void
}
