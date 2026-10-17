/** The subset of the standard WebSocket the anisette v3 provisioning session uses. */
export type WebSocketLike = {
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: { readonly data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose:
    | ((event: { readonly code?: number; readonly reason?: string }) => void)
    | null
}

/** Opens a WebSocket (Node 22+ and Electron provide the standard `WebSocket` global). */
export type WebSocketFactory = (url: string) => WebSocketLike
