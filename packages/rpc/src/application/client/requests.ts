// Requests waiting for their response: each settles once, on its response, its timeout, or the channel closing.
import { type LoadstarError, toLoadstarError } from "@loadstar/kernel";
import { disconnected, timedOut } from "@rpc/domain/errors.ts";
import type { Transport } from "@rpc/domain/ports/transport.ts";
import { PROTOCOL_VERSION } from "@rpc/domain/protocol/common.ts";
import type { RequestBody } from "@rpc/domain/protocol/requests.ts";

interface Waiting {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: LoadstarError) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export interface RequestTable {
  send(body: RequestBody): Promise<unknown>;
  resolve(id: string, value: unknown): void;
  reject(id: string, error: LoadstarError): void;
  /** Rejects everything waiting, and every later request, with `rpc.disconnected`. */
  close(): void;
}

export const createRequestTable = (transport: Transport, timeoutMs: number): RequestTable => {
  const waiting = new Map<string, Waiting>();
  let closed = false;

  const settle = (id: string): Waiting | undefined => {
    const entry = waiting.get(id);
    if (!entry) return undefined;
    waiting.delete(id);
    clearTimeout(entry.timer);
    return entry;
  };

  const reject = (id: string, error: LoadstarError): void => settle(id)?.reject(error);

  const post = (id: string, body: RequestBody): void => {
    try {
      transport.send({ v: PROTOCOL_VERSION, id, ...body });
    } catch (error) {
      reject(id, toLoadstarError(error, disconnected().code));
    }
  };

  return {
    send: (body) => {
      if (closed) return Promise.reject(disconnected());
      const id = crypto.randomUUID();
      const response = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => settle(id)?.reject(timedOut(timeoutMs)), timeoutMs);
        waiting.set(id, { resolve, reject, timer });
      });
      post(id, body);
      return response;
    },
    resolve: (id, value) => settle(id)?.resolve(value),
    reject,
    close: () => {
      closed = true;
      for (const id of [...waiting.keys()]) reject(id, disconnected());
    },
  };
};
