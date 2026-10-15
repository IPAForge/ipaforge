// One HTTP exchange over node:http(s), without following redirects. Every request uses a fresh connection (no
// agent pooling): Apple's GrandSlam front door rate-limits pooled connections.
import { Buffer } from "node:buffer";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { TRUSTED_ROOTS } from "@desktop/main/adapters/http/trusted-roots.ts";
import { compact, ErrorCode, LoadstarError } from "@loadstar/kernel";

export interface SendOptions {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: Uint8Array | string;
  readonly signal?: AbortSignal;
}

/** An explicit length instead of chunked encoding: some servers read chunked bodies as empty. */
const withContentLength = (headers: Record<string, string>, body: Uint8Array | string | undefined) =>
  body === undefined ? headers : { ...headers, "Content-Length": String(Buffer.byteLength(body)) };

/** An abort surfaces as the caller's reason; anything else means the host could not be reached. */
const requestFailure = (error: Error, url: URL, signal: AbortSignal | undefined): unknown =>
  error.name === "AbortError" && signal?.reason instanceof Error
    ? signal.reason
    : new LoadstarError(ErrorCode.Offline, { cause: error, data: { host: url.host } });

export const send = (url: URL, options: SendOptions): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const request = (isHttps ? httpsRequest : httpRequest)(
      url,
      {
        method: options.method,
        headers: withContentLength(options.headers, options.body),
        agent: false,
        ...compact({ ca: isHttps ? [...TRUSTED_ROOTS] : undefined, signal: options.signal }),
      },
      resolve,
    );
    request.once("error", (error) => reject(requestFailure(error, url, options.signal)));
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });

/** Response headers as one string each (repeated headers joined with ", "). */
export const toHeaders = (message: IncomingMessage): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(message.headers)) {
    if (value !== undefined) out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
};
