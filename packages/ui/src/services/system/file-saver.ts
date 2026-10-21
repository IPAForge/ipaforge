/**
 * Saves what the user asked to keep (the logs, a pairing file, a .p12) as a file. Browser and Electron renderer: a
 * download, which a browser saves to its downloads folder and Electron asks where to save with the system dialog.
 */
export type FileSaver = {
  /** Text is saved as UTF-8; bytes as they are. */
  save: (name: string, content: string | Uint8Array) => Promise<void>
}

const TEXT_TYPE = 'text/plain;charset=utf-8'
const BYTES_TYPE = 'application/octet-stream'

export const createDownloadFileSaver = (
  host: Pick<Window, 'document'> & { readonly URL: typeof URL }
): FileSaver => ({
  save: async (name, content) => {
    const blob =
      typeof content === 'string'
        ? new Blob([content], { type: TEXT_TYPE })
        : new Blob([new Uint8Array(content)], { type: BYTES_TYPE })
    const url = host.URL.createObjectURL(blob)
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

/** Keeps what was saved, for tests: text as `text`, bytes as `bytes`. */
export const createMemoryFileSaver = (): FileSaver & {
  readonly saved: {
    readonly name: string
    readonly text?: string
    readonly bytes?: Uint8Array
  }[]
} => {
  const saved: { name: string; text?: string; bytes?: Uint8Array }[] = []

  return {
    saved,
    save: async (name, content) => {
      saved.push(
        typeof content === 'string'
          ? { name, text: content }
          : { name, bytes: content }
      )
    }
  }
}
