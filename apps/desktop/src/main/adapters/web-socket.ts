// WebSocketFactory over the standard WebSocket that Node 22+ and Electron provide.
import type { WebSocketFactory, WebSocketLike } from "@loadstar/apple";

export const createWebSocketFactory = (): WebSocketFactory => (url) => {
  const Socket = globalThis.WebSocket;
  if (!Socket) throw new Error("this runtime has no WebSocket (Node 22+ required)");
  return new Socket(url) as unknown as WebSocketLike;
};
