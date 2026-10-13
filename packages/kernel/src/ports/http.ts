export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
  readonly signal?: AbortSignal;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** The body as a stream; use the `readBody` helper to buffer it when small. */
  readonly body: ReadableStream<Uint8Array>;
}

/**
 * Outbound HTTP. Desktop talks to the internet directly; the web shell routes Apple endpoints
 * through the relay. Implementations reject with `LoadstarError("net.offline")` when there is no network.
 */
export interface HttpClient {
  request(request: HttpRequest): Promise<HttpResponse>;
}

/** Buffer a response body, refusing bodies larger than `limit` bytes. */
export const readBody = async (response: HttpResponse, limit = 32 * 1024 * 1024): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new RangeError(`response body exceeds ${limit} bytes`);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
};
