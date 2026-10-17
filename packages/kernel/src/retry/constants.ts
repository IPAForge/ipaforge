/** HTTP statuses worth retrying: rate limiting and gateway errors. */
export const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([
  429, 502, 503, 504
])
