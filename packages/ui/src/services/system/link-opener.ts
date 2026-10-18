/**
 * Opens a web page in the user's browser (a pre-filled GitHub issue, an Apple account page). Browser: a new tab.
 * Electron: the main process opens only an allowed list of addresses in the default browser, never a window.
 */
export type LinkOpener = {
  open: (url: string) => void
}

export const createWindowLinkOpener = (
  host: Pick<Window, 'open'>
): LinkOpener => ({
  open: (url) => {
    host.open(url, '_blank', 'noopener,noreferrer')
  }
})

/** Keeps what was opened, for tests. */
export const createMemoryLinkOpener = (): LinkOpener & {
  readonly opened: string[]
} => {
  const opened: string[] = []

  return {
    opened,
    open: (url) => {
      opened.push(url)
    }
  }
}
