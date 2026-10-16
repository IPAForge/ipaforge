/** Writes text to the system clipboard ("Copy diagnostics"). Browser: `navigator.clipboard`. */
export type ClipboardWriter = {
  writeText: (text: string) => Promise<void>
}

export const createNavigatorClipboard = (
  navigator: Pick<Navigator, 'clipboard'>
): ClipboardWriter => ({
  writeText: (text) => navigator.clipboard.writeText(text)
})

/** Keeps what was written, for tests. */
export const createMemoryClipboard = (): ClipboardWriter & {
  readonly written: string[]
} => {
  const written: string[] = []

  return {
    written,
    writeText: async (text) => {
      written.push(text)
    }
  }
}
