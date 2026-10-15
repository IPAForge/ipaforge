// Node HttpClient over node:https.
// - Trust: the standard Node roots plus Apple Root CA. Apple's own services (gsa.apple.com, developer services)
//   use certificates from Apple's private CA, which public root stores do not include. Verification stays on.
// - Every request uses a fresh connection (no agent pooling): Apple's GrandSlam front door rate-limits pooled
//   connections.

import { Buffer } from "node:buffer";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { rootCertificates } from "node:tls";
import { encodePem } from "@loadstar/device";
import type { HttpClient, HttpResponse } from "@loadstar/kernel";
import { ErrorCode, fromBase64, LoadstarError } from "@loadstar/kernel";
import { APPLE_CERTIFICATES } from "@loadstar/signer";

const appleRoots = APPLE_CERTIFICATES.filter((certificate) => certificate.kind === "root").map((certificate) =>
  encodePem("CERTIFICATE", fromBase64(certificate.der)),
);

/** Node's bundled roots plus Apple's roots. */
export const TRUSTED_ROOTS: readonly string[] = [...rootCertificates, ...appleRoots];

const MAX_REDIRECTS = 5;

/** Headers that identify the user or this machine; never forwarded to another host on redirect. */
const SENSITIVE_HEADER =
  /^(authorization|cookie|security-code|x-apple-identity-token|x-apple-gs-token|x-apple-i-.*|x-mme-.*)$/i;

/**
 * Follows a redirect only if it is safe: never from HTTPS down to HTTP, and when the host changes, identifying
 * headers are dropped.
 */
export const redirectTarget = (
  from: URL,
  location: string,
  headers: Readonly<Record<string, string>>,
): { url: URL; headers: Record<string, string> } => {
  const url = new URL(location, from);
  if (from.protocol === "https:" && url.protocol !== "https:") {
    throw new LoadstarError(ErrorCode.Offline, {
      message: `refused a redirect from HTTPS to ${url.protocol}`,
      data: { host: from.host, location: url.host },
    });
  }
  if (url.host === from.host) return { url, headers: { ...headers } };
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) if (!SENSITIVE_HEADER.test(name)) kept[name] = value;
  return { url, headers: kept };
};

const toHeaders = (message: IncomingMessage): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(message.headers)) {
    if (value !== undefined) out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
};

const send = (
  url: URL,
  options: { method: string; headers: Record<string, string>; body?: Uint8Array | string; signal?: AbortSignal },
): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        method: options.method,
        // An explicit length instead of chunked encoding: some servers read chunked bodies as empty.
        headers:
          options.body === undefined
            ? options.headers
            : { ...options.headers, "Content-Length": String(Buffer.byteLength(options.body)) },
        agent: false,
        ...(url.protocol === "https:" ? { ca: [...TRUSTED_ROOTS] } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      },
      resolve,
    );
    request.once("error", (error) => {
      if (error.name === "AbortError" && options.signal?.reason instanceof Error) reject(options.signal.reason);
      else reject(new LoadstarError(ErrorCode.Offline, { cause: error, data: { host: url.host } }));
    });
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });

export const createNodeHttpClient = (): HttpClient => ({
  request: async (request): Promise<HttpResponse> => {
    let url = new URL(request.url);
    let method: string = request.method;
    let body = request.body;
    let headers: Record<string, string> = { ...request.headers };
    for (let redirects = 0; ; redirects++) {
      const message = await send(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        ...(request.signal ? { signal: request.signal } : {}),
      });
      const status = message.statusCode ?? 0;
      const location = message.headers.location;
      if (status >= 300 && status < 400 && location && redirects < MAX_REDIRECTS) {
        message.resume();
        ({ url, headers } = redirectTarget(url, location, headers));
        if (status === 303) {
          method = "GET";
          body = undefined;
        }
        continue;
      }
      return {
        status,
        headers: toHeaders(message),
        body: Readable.toWeb(message) as ReadableStream<Uint8Array>,
      };
    }
  },
});
