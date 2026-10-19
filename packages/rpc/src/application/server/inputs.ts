// Wire inputs into Engine inputs: named IPAs become files that remember where they came from (catalog apps stay
// catalog sources, the flows download them), an installed app becomes its kept IPA (Refresh), and optional fields
// lose their `undefined`s.
import type {
  AppSource,
  Engine,
  InstallAppsInput,
  PlanInstallInput,
  RefreshAppsInput
} from '@ipaforge/installer'
import { compact } from '@ipaforge/kernel'
import type {
  InstallAppsCall,
  PlanInstallCall,
  RefreshAppsCall
} from '@rpc/application/server/types.ts'
import type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
import type { IpaSource } from '@rpc/domain/protocol/types.ts'

/** What turning a named IPA into a source needs: the resolver, the Engine (for kept IPAs) and the device. */
export type SourceContext = {
  readonly resolveIpa: ResolveIpa
  readonly engine: Engine
  readonly udid: string
}

export const toAppSource = async (
  source: IpaSource,
  context: SourceContext,
  signal: AbortSignal
): Promise<AppSource> => {
  if (source.kind === 'catalog')
    return compact({
      kind: source.kind,
      appId: source.appId,
      channel: source.channel
    })
  if (source.kind === 'installed')
    return context.engine.installedSource(context.udid, source.bundleId)

  const file = await context.resolveIpa(source, signal)

  return {
    kind: 'file',
    file,
    origin:
      source.kind === 'url'
        ? { kind: 'url', url: source.url }
        : { kind: 'file', name: file.name }
  }
}

export const toPlanInstallInput = async (
  input: PlanInstallCall,
  context: Omit<SourceContext, 'udid'>,
  signal: AbortSignal
): Promise<PlanInstallInput> =>
  compact({
    ...input,
    source: await toAppSource(
      input.source,
      { ...context, udid: input.udid },
      signal
    )
  })

const toAppSources = async (
  input: InstallAppsCall,
  context: Omit<SourceContext, 'udid'>,
  signal: AbortSignal
): Promise<AppSource[]> => {
  const apps: AppSource[] = []

  // One at a time: each may be a download, and a failure should not leave others running.
  for (const source of input.apps)
    apps.push(
      await toAppSource(source, { ...context, udid: input.udid }, signal)
    )

  return apps
}

export const toInstallAppsInput = async (
  input: InstallAppsCall,
  context: Omit<SourceContext, 'udid'>,
  signal: AbortSignal
): Promise<InstallAppsInput> =>
  compact({ ...input, apps: await toAppSources(input, context, signal) })

export const toRefreshAppsInput = async (
  input: RefreshAppsCall,
  context: Omit<SourceContext, 'udid'>,
  signal: AbortSignal
): Promise<RefreshAppsInput> =>
  compact({ ...input, apps: await toAppSources(input, context, signal) })
