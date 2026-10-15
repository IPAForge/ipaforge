// Node HttpClient over node:https.
// - Trust: the standard Node roots plus Apple Root CA (see http/trusted-roots.ts). Verification stays on.
// - Every request uses a fresh connection (no agent pooling): Apple's GrandSlam front door rate-limits pooled
//   connections.
// - Redirects are followed only when safe (see http/redirects.ts); compressed bodies are decoded.

import { Readable } from "node:stream";
import { decoded } from "@desktop/main/adapters/http/content-decoding.ts";
import { redirectTarget, shouldFollow } from "@desktop/main/adapters/http/redirects.ts";
import { send, toHeaders } from "@desktop/main/adapters/http/send.ts";
import type { HttpClient, HttpRequest, HttpResponse } from "@loadstar/kernel";
import { compact } from "@loadstar/kernel";

interface Hop {
  readonly url: URL;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: HttpRequest["body"];
}

const firstHop = (request: HttpRequest): Hop => ({
  url: new URL(request.url),
  method: request.method,
  headers: { ...request.headers },
  body: request.body,
});

/** The next request after a redirect; 303 means "fetch the result with GET", so the body is dropped. */
const nextHop = (hop: Hop, status: number, location: string): Hop => {
  const { url, headers } = redirectTarget(hop.url, location, hop.headers);
  if (status === 303) return { url, headers, method: "GET", body: undefined };
  return { ...hop, url, headers };
};

export const createNodeHttpClient = (): HttpClient => ({
  request: async (request): Promise<HttpResponse> => {
    let hop = firstHop(request);
    for (let redirects = 0; ; redirects++) {
      const message = await send(hop.url, {
        method: hop.method,
        headers: hop.headers,
        ...compact({ body: hop.body, signal: request.signal }),
      });
      const status = message.statusCode ?? 0;
      const location = message.headers.location;
      if (shouldFollow(status, location, redirects)) {
        message.resume();
        hop = nextHop(hop, status, location);
        continue;
      }
      const headers = toHeaders(message);
      return { status, headers, body: Readable.toWeb(decoded(message, headers)) as ReadableStream<Uint8Array> };
    }
  },
});
