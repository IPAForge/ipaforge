// The fake host's side of named IPAs: there is no file system, so a picked file is an empty file with its name,
// and a link takes a moment to "download" first, so the Preload page shows it working.
import { bytesFileSource, type FileSource } from '@ipaforge/kernel'
import type { ExternalIpa } from '@ipaforge/rpc'

const DOWNLOAD_MS = 600

const lastSegment = (path: string) => path.split(/[\\/]/).pop() || path

const nameOf = (ipa: ExternalIpa) =>
  ipa.kind === 'file'
    ? lastSegment(ipa.path)
    : decodeURIComponent(lastSegment(new URL(ipa.url).pathname)) ||
      'download.ipa'

export const createFakeResolveIpa =
  (delayMs: number) =>
  async (ipa: ExternalIpa): Promise<FileSource> => {
    if (ipa.kind === 'url')
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs && DOWNLOAD_MS)
      )
    return bytesFileSource(nameOf(ipa), new Uint8Array(0))
  }

/** What the fake file dialog picks. */
/** The folder the fake's dialog picks for Save signed .ipa instead. */
export const FAKE_SAVE_FOLDER = '/Users/you/Signed apps'

export const FAKE_CHOSEN_IPAS = [
  {
    path: '/Users/you/Downloads/MyGame.ipa',
    name: 'MyGame.ipa',
    size: 48_000_000
  }
] as const
