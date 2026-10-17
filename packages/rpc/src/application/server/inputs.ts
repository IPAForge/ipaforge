// Wire inputs into Engine inputs: named IPAs become files (catalog apps stay catalog sources, the flows download
// them), and optional fields lose their `undefined`s.
import type {
  AppSource,
  InstallAppsInput,
  PlanInstallInput
} from '@loadstar/installer'
import { compact } from '@loadstar/kernel'
import type {
  InstallAppsCall,
  PlanInstallCall
} from '@rpc/application/server/types.ts'
import type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
import type { IpaSource } from '@rpc/domain/protocol/types.ts'

export const toAppSource = async (
  source: IpaSource,
  resolveIpa: ResolveIpa,
  signal: AbortSignal
): Promise<AppSource> =>
  source.kind === 'catalog'
    ? compact({
        kind: source.kind,
        appId: source.appId,
        channel: source.channel
      })
    : { kind: 'file', file: await resolveIpa(source, signal) }

export const toPlanInstallInput = async (
  input: PlanInstallCall,
  resolveIpa: ResolveIpa,
  signal: AbortSignal
): Promise<PlanInstallInput> =>
  compact({
    ...input,
    source: await toAppSource(input.source, resolveIpa, signal)
  })

export const toInstallAppsInput = async (
  input: InstallAppsCall,
  resolveIpa: ResolveIpa,
  signal: AbortSignal
): Promise<InstallAppsInput> => {
  const apps: AppSource[] = []
  // One at a time: each may be a download, and a failure should not leave others running.
  for (const source of input.apps)
    apps.push(await toAppSource(source, resolveIpa, signal))
  return compact({ ...input, apps })
}
