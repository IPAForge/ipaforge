// `provisionApp`: everything the signer needs for one install, inside the free-account limits. The App ID budget is
// checked before anything is written.

import {
  assignAppGroup,
  createAppId,
  downloadProfile,
  ensureAppGroup,
  listAppIds
} from '@apple/application/developer/app-ids.ts'
import type { DeveloperContext } from '@apple/application/developer/context.ts'
import { registerDevice } from '@apple/application/developer/devices.ts'
import type {
  BundleRequest,
  ProvisionProgress,
  ProvisionRequest,
  ProvisionResult,
  ProvisionTask
} from '@apple/application/developer/types.ts'
import { planAppIds } from '@apple/domain/developer.ts'
import type { AppId, AppIdPlan, Team } from '@apple/domain/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** Counts the requests to Apple and reports each one done, within its task and overall. */
const progressCounter = (
  onProgress: ((progress: ProvisionProgress) => void) | undefined
) => {
  let overall = 0
  let expected = 1

  return {
    /** How many requests the whole provisioning makes, once it's known. */
    expect: (total: number) => {
      expected = Math.max(total, overall)
    },
    done: (task: ProvisionTask, done: number, total: number) => {
      overall += 1
      onProgress?.({
        task,
        done,
        total,
        fraction: Math.min(1, overall / expected)
      })
    }
  }
}

type Counter = ReturnType<typeof progressCounter>

const TEAM_REQUESTS = 2

const assertEnoughAppIds = (plan: AppIdPlan): void => {
  if (plan.enough) return
  throw new IPAForgeError(ErrorCode.AppIdQuotaExceeded, {
    data: compact({
      needed: plan.create.length,
      available: plan.available,
      nextSlotAt: plan.nextSlotAt?.toISOString()
    })
  })
}

/** The planned App IDs plus the ones created now, by bundle identifier. */
const resolveAppIds = async (
  ctx: DeveloperContext,
  team: Team,
  bundles: readonly BundleRequest[],
  plan: AppIdPlan,
  counter: Counter
): Promise<Map<string, AppId>> => {
  const byIdentifier = new Map(
    plan.reuse.map((appId) => [appId.identifier, appId])
  )
  let created = 0

  for (const bundle of bundles) {
    if (byIdentifier.has(bundle.identifier)) continue
    byIdentifier.set(
      bundle.identifier,
      await createAppId(ctx, team, bundle.identifier, bundle.name)
    )
    created += 1
    counter.done('app-ids', created, plan.create.length)
  }
  return byIdentifier
}

const assignGroupToAll = async (
  ctx: DeveloperContext,
  team: Team,
  identifier: string,
  appIds: readonly AppId[],
  counter: Counter
): Promise<void> => {
  const total = appIds.length + 1
  const group = await ensureAppGroup(ctx, team, identifier)

  counter.done('app-group', 1, total)
  for (const [index, appId] of appIds.entries()) {
    await assignAppGroup(ctx, team, appId, group)
    counter.done('app-group', index + 2, total)
  }
}

const downloadProfiles = async (
  ctx: DeveloperContext,
  team: Team,
  appIds: ReadonlyMap<string, AppId>,
  counter: Counter
): Promise<Map<string, Uint8Array>> => {
  const profiles = new Map<string, Uint8Array>()

  for (const [identifier, appId] of appIds) {
    profiles.set(identifier, (await downloadProfile(ctx, team, appId)).data)
    counter.done('profiles', profiles.size, appIds.size)
  }
  return profiles
}

export const provisionApp = async (
  ctx: DeveloperContext,
  request: ProvisionRequest
): Promise<ProvisionResult> => {
  const { team, bundles } = request
  const counter = progressCounter(request.onProgress)

  await registerDevice(ctx, team, request.device.udid, request.device.name)
  counter.done('team', 1, TEAM_REQUESTS)

  const { appIds, quota } = await listAppIds(ctx, team)

  counter.done('team', TEAM_REQUESTS, TEAM_REQUESTS)

  const plan = planAppIds(
    bundles.map((bundle) => bundle.identifier),
    appIds,
    quota,
    ctx.deps.clock.now()
  )

  assertEnoughAppIds(plan)
  // Every request from here: App IDs to make, the app group and its assignments, and one profile per bundle.
  counter.expect(
    TEAM_REQUESTS +
      plan.create.length +
      (request.appGroup ? bundles.length + 1 : 0) +
      bundles.length
  )

  const byIdentifier = await resolveAppIds(ctx, team, bundles, plan, counter)

  if (request.appGroup)
    await assignGroupToAll(
      ctx,
      team,
      request.appGroup,
      [...byIdentifier.values()],
      counter
    )

  const profiles = await downloadProfiles(ctx, team, byIdentifier, counter)
  ctx.deps.logger.info('provisioned app', {
    bundles: bundles.length,
    created: plan.create.length
  })
  return { appIds: byIdentifier, profiles, plan }
}
