/**
 * Saves text the user asked to keep (the logs) as a file. Browser and Electron renderer: a download, which a
 * browser saves to its downloads folder and Electron asks where to save with the system dialog.
 */
export type FileSaver = {
  save: (name: string, text: string) => Promise<void>
}

const TEXT_TYPE = 'text/plain;charset=utf-8'

export const createDownloadFileSaver = (
  host: Pick<Window, 'document'> & { readonly URL: typeof URL }
): FileSaver => ({
  save: async (name, text) => {
    const url = host.URL.createObjectURL(new Blob([text], { type: TEXT_TYPE }))
    try {
      const link = host.document.createElement('a')
      link.href = url
      link.download = name
      link.click()
    } finally {
      // The download has its own copy once it starts; the next task is late enough to let go of the blob.
      setTimeout(() => host.URL.revokeObjectURL(url), 0)
    }
  }
})

/** Keeps what was saved, for tests. */
export const createMemoryFileSaver = (): FileSaver & {
  readonly saved: { readonly name: string; readonly text: string }[]
} => {
  const saved: { name: string; text: string }[] = []

  return {
    saved,
    save: async (name, text) => {
      saved.push({ name, text })
    }
  }
}
