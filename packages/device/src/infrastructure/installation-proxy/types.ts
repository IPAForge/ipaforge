import type { InstalledApp } from '@device/infrastructure/installation-proxy/apps.ts'
import type { PlistValue } from '@loadstar/kernel'

export type ApplicationType = 'User' | 'System' | 'Any'

export type InstallProgress = {
  readonly percent: number
  readonly status: string
}

export type InstallationProxy = {
  install(
    packagePath: string,
    options?: { upgrade?: boolean; onProgress?: (p: InstallProgress) => void }
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
