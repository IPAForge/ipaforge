// RPC tunables, with the defaults the app ships with.

export type RpcConfig = {
  /**
   * How long the client waits for the answer to one request. Runs are not bound by it (an install takes as long
   * as it takes); queries are, and `planInstall` may download an IPA first, hence the generous default.
   */
  readonly requestTimeoutMs: number
}

export const DEFAULT_RPC_CONFIG: RpcConfig = {
  requestTimeoutMs: 10 * 60 * 1000
}
