import type { Logger } from '@ipaforge/kernel'
import type { ManualPackage, UpdateSource } from '@ipaforge/rpc'

/** How this copy was installed: one that updates itself (dmg/zip, NSIS, AppImage), or a package that can't. */
export type InstallKind = 'self' | ManualPackage

/** What tells how this copy was installed (Electron's `process` and the file system). */
export type InstallProbe = {
  readonly platform: NodeJS.Platform
  /** Set by the AppImage runtime. */
  readonly appImage: string | undefined
  readonly resourcesPath: string
  readonly execPath: string
  readonly productName: string
  exists(path: string): boolean
  readText(path: string): string | undefined
}

export type DownloadProgress = {
  readonly transferred: number
  readonly total: number
  readonly bytesPerSecond: number
}

/** The part of electron-updater the update service uses. */
export type UpdaterPort = {
  /** The newer version that is out, if there is one. */
  check(): Promise<string | undefined>
  /** Downloads it, reporting progress; settles with the downloaded file once it is ready to install. */
  download(onProgress: (progress: DownloadProgress) => void): Promise<string>
  /** Quits, installs it and opens the new version; rejects if installing fails before IPAForge quits. */
  install(): Promise<void>
}

/** Checks a downloaded update came from IPAForge's release of that version; rejects if not. */
export type UpdateVerifier = {
  verify(file: string, version: string): Promise<void>
}

/** What the Sigstore verifier needs: the network, the file system, and where Sigstore's trust root is kept. */
export type UpdateVerifierDeps = {
  /** Fetches a JSON document over HTTPS; rejects on anything but a 2xx answer. */
  fetchJson(url: string): Promise<unknown>
  readFile(path: string): Promise<Uint8Array>
  /** Sigstore's trust root (TUF metadata), cached between launches. */
  readonly tufCachePath: string
  /** sigstore-js's `verify`; replaced in tests. */
  readonly verifyBundle?: typeof import('sigstore').verify
}

export type UpdateServiceDeps = {
  /** None in a development build: nothing to update. */
  readonly updater: UpdaterPort | undefined
  /** Checks the downloaded file before it may be installed. */
  readonly verifier: UpdateVerifier
  readonly kind: InstallKind
  /** `process.arch`, to name the right file for a package that can't update itself. */
  readonly arch: string
  readonly logger: Logger
  readonly checkTimeoutMs?: number
  readonly installDelayMs?: number
}

/** The updater as the window sees it, started once on launch. */
export type UpdateService = UpdateSource & { start(): void }

/** A release file's name parts for a package that can't update itself. */
export type ManualFile = {
  readonly os: string
  /** electron-builder's name for each CPU in the file name. */
  readonly arch: Readonly<Record<string, string>>
  readonly extension: string
}
