// A run's events, replayed to late subscribers: the UI may subscribe a moment after the run started.

export type EventLog<E> = {
  emit(event: E): void
  /** Delivers every past event, then each new one, until the returned function is called. */
  subscribe(listener: (event: E) => void): () => void
}

export const createEventLog = <E>(): EventLog<E> => {
  const history: E[] = []
  const listeners = new Set<(event: E) => void>()

  return {
    emit: (event) => {
      history.push(event)
      for (const listener of listeners) listener(event)
    },
    subscribe: (listener) => {
      for (const event of history) listener(event)
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
