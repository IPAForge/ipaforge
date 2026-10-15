// The RPC Transport over an Electron main-process MessagePort (`MessagePortMain`). The port is described here
// structurally, so this compiles and is tested without the electron package; Electron's own type fits it.
import type { Transport } from "@loadstar/rpc";

type MessageListener = (event: { readonly data: unknown }) => void;

/** The part of Electron's `MessagePortMain` the transport uses. */
export interface MainMessagePort {
  postMessage(message: unknown): void;
  on(event: "message", listener: MessageListener): unknown;
  on(event: "close", listener: () => void): unknown;
  off(event: "message", listener: MessageListener): unknown;
  off(event: "close", listener: () => void): unknown;
  /** Messages are queued until the port is started. */
  start(): void;
  close(): void;
}

export const messagePortTransport = (port: MainMessagePort): Transport => {
  port.start();
  return {
    send: (message) => port.postMessage(message),
    onMessage: (listener) => {
      const onMessage: MessageListener = (event) => listener(event.data);
      port.on("message", onMessage);
      return () => port.off("message", onMessage);
    },
    onClose: (listener) => {
      port.on("close", listener);
      return () => port.off("close", listener);
    },
    close: () => port.close(),
  };
};
