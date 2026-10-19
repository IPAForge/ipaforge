/** Refreshing apps by themselves: on or off, and how many days before an app expires. */
export type AutoRefreshSettings = {
  readonly isOn: boolean
  readonly daysBefore: number
}

export type AutoRefreshStore = {
  getState: () => AutoRefreshSettings
  subscribe: (listener: () => void) => () => void
  set: (settings: Partial<AutoRefreshSettings>) => void
}
