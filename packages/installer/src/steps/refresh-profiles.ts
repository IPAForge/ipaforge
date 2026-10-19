// Refreshing an app the way SideStore does: Apple makes a new profile for each of its App IDs (the app and its
// extensions), the new profiles go on the device, and the old ones come off. The app isn't reinstalled: its
// signature stays valid with its certificate, and the new profiles give it another 7 days (a year, paid teams).
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { appStepId, required } from '@installer/steps/app-job.ts'
import type { DeviceProfile } from '@ipaforge/device'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** The app's own profile and its extensions' (`TEAMID.app` and `TEAMID.app.extension`). */
const profilesOf = (
  profiles: readonly DeviceProfile[],
  teamId: string,
  bundleId: string
) =>
  profiles.filter((profile) => {
    const id = profile.applicationIdentifier

    return (
      profile.teamId === teamId &&
      (id === `${teamId}.${bundleId}` ||
        id?.startsWith(`${teamId}.${bundleId}.`))
    )
  })

const bundleOf = (profile: DeviceProfile, teamId: string) =>
  profile.applicationIdentifier?.slice(teamId.length + 1) ?? ''

export const refreshProfilesStep = (
  runtime: FlowRuntime,
  bundleId: string,
  index: number
): Step<InstallState> => ({
  id: appStepId('profiles', index),
  labelKey: StepLabel.refreshProfiles,
  weight: StepWeight.provision,
  run: async (state, context) => {
    const team = required(state.team, 'team')
    const handle = await runtime.device(state.udid)
    const developer = await runtime.developer(state.accountId)
    const old = profilesOf(await handle.listProfiles(), team.id, bundleId)
    const bundles = [
      ...new Set(old.map((profile) => bundleOf(profile, team.id)))
    ]
    const { appIds } = await developer.appIds(team)
    const wanted = appIds.filter((appId) => bundles.includes(appId.identifier))

    if (wanted.length === 0)
      throw new IPAForgeError(ErrorCode.KeptIpaMissing, {
        message: 'no App ID left for this app',
        data: { bundleId }
      })

    const installed = new Set<string>()

    for (const [done, appId] of wanted.entries()) {
      const profile = await developer.profile(team, appId)

      await handle.installProfile(profile.data)
      installed.add(profile.uuid.toUpperCase())
      context.progress((done + 1) / wanted.length)
    }
    // The new profiles are on the device; the ones they replace come off. Apple can hand back the same profile:
    // that one stays.
    for (const profile of old)
      if (!installed.has(profile.uuid.toUpperCase()))
        await handle.removeProfile(profile.uuid)
    context.detail({ kind: 'profiles', count: wanted.length })
    runtime.deps.logger.info('app refreshed with new profiles', {
      bundleId,
      profiles: wanted.length
    })

    return undefined
  }
})
