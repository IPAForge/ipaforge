import type { InstalledApp } from '@device/infrastructure/installation-proxy/apps.ts'
import type { PlistValue } from '@ipaforge/kernel'

export type ApplicationType = 'User' | 'System' | 'Any'

export type InstallProgress = {
  readonly percent: number
  readonly status: string
}

export type InstallationProxy = {
  install(
    packagePath: string,
    options?: {
      upgrade?: boolean
      onProgress?: (p: InstallProgress) => void
      /** Stops waiting (and closes the service) when aborted. */
      signal?: AbortSignal | undefined
      /** The longest silence from the device before giving up with `device.timeout`. */
      idleTimeoutMs?: number | undefined
    }
  ): Promise<void>
  uninstall(
    bundleId: string,
    options?: { onProgress?: (p: InstallProgress) => void }
  ): Promise<void>
  browse(options?: {
    applicationType?: ApplicationType
    attributes?: readonly string[]
  }): Promise<InstalledApp[]>
  lookup(
    bundleIds: readonly string[],
    attributes?: readonly string[]
  ): Promise<Map<string, InstalledApp>>
  close(): Promise<void>
}

export type Fields = readonly (readonly [string, PlistValue])[]

/** What a command's wait for the device stops on: silence that long, or an abort. */
export type Watch = {
  readonly signal?: AbortSignal | undefined
  readonly idleTimeoutMs?: number | undefined
}
