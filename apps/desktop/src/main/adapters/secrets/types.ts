export type SecretRecord = Record<string, string>

export type SecretRecordStorage = {
  /** Returns the cached record, loading it on first use. */
  readonly load: () => Promise<SecretRecord>
  readonly save: (values: SecretRecord) => Promise<void>
}
