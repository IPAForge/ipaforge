// Lifetime helpers for anything with an async `close()`: links, service clients, lockdown connections.

export type Closeable = {
  close(): Promise<void>
}

/** Runs `use` with `resource` and always closes it. */
export const withClient = async <C extends Closeable, T>(
  resource: C,
  use: (resource: C) => Promise<T>
): Promise<T> => {
  try {
    return await use(resource)
  } finally {
    await resource.close()
  }
}

/** Runs `setup` on a freshly opened `resource`, closing it only when `setup` fails (otherwise the caller owns it). */
export const closeOnError = async <C extends Closeable, T>(
  resource: C,
  setup: (resource: C) => Promise<T>
): Promise<T> => {
  try {
    return await setup(resource)
  } catch (error) {
    await resource.close()
    throw error
  }
}
