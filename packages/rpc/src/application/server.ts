// The Engine's side of the channel: validates every request, answers queries, starts and tracks runs, and sends
// every failure back as a serialized LoadstarError. Nothing a peer sends can make it throw.
import type { Engine } from "@loadstar/installer";
import { type LoadstarError, type Logger, silentLogger, toLoadstarError } from "@loadstar/kernel";
import { createCheckpointStore } from "@rpc/application/server/checkpoints.ts";
import { createCommandStarter } from "@rpc/application/server/commands.ts";
import { createQueryRunner } from "@rpc/application/server/queries.ts";
import { createRunRegistry } from "@rpc/application/server/runs.ts";
import { invalidMessage } from "@rpc/domain/errors.ts";
import type { ResolveIpa } from "@rpc/domain/ports/resolve-ipa.ts";
import type { Transport } from "@rpc/domain/ports/transport.ts";
import { PROTOCOL_VERSION, referencedId } from "@rpc/domain/protocol/common.ts";
import type { MessageBody } from "@rpc/domain/protocol/messages.ts";
import { type Request, requestSchema } from "@rpc/domain/protocol/requests.ts";
import { toWire } from "@rpc/domain/wire.ts";
import type { z } from "zod";

export interface RpcServerOptions {
  readonly engine: Engine;
  readonly transport: Transport;
  readonly resolveIpa: ResolveIpa;
  readonly logger?: Logger;
}

export interface RpcServer {
  /** Cancels every run and closes the channel. */
  close(): void;
}

type RequestHandlers = { readonly [R in Request as R["type"]]: (request: R) => unknown };

export const createRpcServer = ({
  engine,
  transport,
  resolveIpa,
  logger = silentLogger,
}: RpcServerOptions): RpcServer => {
  const log = logger.child({ scope: "rpc" });
  const lifetime = new AbortController();
  const checkpoints = createCheckpointStore();

  const send = (body: MessageBody): void => {
    if (lifetime.signal.aborted) return;
    try {
      transport.send({ v: PROTOCOL_VERSION, ...body });
    } catch (error) {
      log.warn("RPC send failed", { type: body.type, code: toLoadstarError(error).code });
    }
  };

  const runQuery = createQueryRunner(engine, resolveIpa);
  const runs = createRunRegistry({ startCommand: createCommandStarter(engine, resolveIpa), checkpoints, send });

  const handlers: RequestHandlers = {
    query: (request) => runQuery(request.call, lifetime.signal),
    start: (request) => runs.start(request),
    answer: (request) => runs.answer(request.runId, request.answer),
    decline: (request) => runs.decline(request.runId),
    cancel: (request) => runs.cancel(request.runId),
  };

  const sendError = (id: string, error: LoadstarError): void => {
    log.debug("RPC request failed", { id, code: error.code });
    send({ type: "error", id, error: error.toJSON() });
  };

  const respond = async (request: Request): Promise<void> => {
    try {
      const value = await (handlers[request.type] as (request: Request) => unknown)(request);
      send({ type: "response", id: request.id, value: toWire(value) });
    } catch (error) {
      sendError(request.id, toLoadstarError(error));
    }
  };

  const rejectInvalid = (message: unknown, issues: z.ZodError): void => {
    const error = invalidMessage(issues);
    log.warn("invalid RPC request", { issues: error.data?.issues });
    const id = referencedId(message);
    if (id !== undefined) sendError(id, error);
  };

  const onMessage = (message: unknown): void => {
    const parsed = requestSchema.safeParse(message);
    if (!parsed.success) {
      rejectInvalid(message, parsed.error);
      return;
    }
    void respond(parsed.data);
  };

  const unsubscribe = transport.onMessage(onMessage);

  const shutdown = (): void => {
    if (lifetime.signal.aborted) return;
    lifetime.abort();
    unsubscribe();
    stopWatchingClose();
    runs.cancelAll();
    checkpoints.clear();
  };

  const stopWatchingClose = transport.onClose(shutdown);

  return {
    close: () => {
      shutdown();
      transport.close();
    },
  };
};
