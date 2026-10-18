export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export type HttpRequest = {
  readonly method: HttpMethod
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array | string
  readonly signal?: AbortSignal
}

export type HttpResponse = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  /** The body as a stream; use the `readBody` helper to buffer it when small. */
  readonly body: ReadableStream<Uint8Array>
}

/**
 * Outbound HTTP, straight to the internet (Apple, GitHub, anisette servers). Implementations reject with `IPAForgeError("net.offline")` when there is no network.
 */
export type HttpClient = {
  request(request: HttpRequest): Promise<HttpResponse>
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Readonly<Record<string, unknown>>

/** Structured logger. Implementations must never throw. */
export type Logger = {
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  /** A logger whose records carry extra bindings, e.g. `{ scope: "signer" }`. */
  child(bindings: LogFields): Logger
}

export type LogRecord = {
  readonly ts: string
  readonly level: LogLevel
  readonly scope: string | undefined
  readonly msg: string
  readonly fields: LogFields
}

/** Where log records go (console, file, in-app log viewer, …). Provided by composition roots. */
export type LogSink = (record: LogRecord) => void
