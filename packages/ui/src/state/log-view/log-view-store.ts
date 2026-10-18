import type { LogViewState, LogViewStore } from '@ui/state/log-view/types.ts'

const INITIAL: LogViewState = { minLevel: 'info', text: '', clearedAfter: 0 }

export const createLogViewStore = (): LogViewStore => {
  const listeners = new Set<() => void>()
  let state = INITIAL

  const update = (patch: Partial<LogViewState>) => {
    state = { ...state, ...patch }
    for (const listener of [...listeners]) listener()
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setMinLevel: (minLevel) => update({ minLevel }),
    setArea: (area) => update({ area }),
    setText: (text) => update({ text }),
    showRun: (run) =>
      update({ run, minLevel: 'info', area: undefined, text: '' }),
    clearRun: () => update({ run: undefined }),
    clear: (lastSeq) => update({ clearedAfter: lastSeq }),
    showAll: () =>
      update({ minLevel: 'debug', area: undefined, text: '', run: undefined })
  }
}
