// The fake installApps: the Engine's steps for a list of apps, with their real ids (`inspect-0`, `install-1`):
// each app found and checked, the Apple account once, then each app provisioned, signed and installed, and
// SideStore given the pairing file when it is in the list. The fake refreshApps adds the apps that only get new
// profiles after them (`profiles-2`), and skips the certificate and App IDs when nothing is signed again.
import { StepLabel } from '@ipaforge/rpc'
import {
  certificate,
  checkDevice,
  chooseTeam,
  download,
  freeApps,
  installing,
  provisioning,
  quick,
  reporting,
  signIn,
  signing,
  step
} from '@ui/services/engine/fake/fake-install-steps.ts'
import type { FakeWorld } from '@ui/services/engine/fake/fake-world.ts'
import type {
  FakeApp,
  FakeInstallState,
  ScriptedStep
} from '@ui/services/engine/fake/types.ts'

const prepareSteps = (
  world: FakeWorld,
  app: FakeApp,
  index: number
): ScriptedStep<FakeInstallState>[] => [
  ...(app.isCatalog
    ? [
        step(
          world,
          `resolve-${index}`,
          StepLabel.resolve,
          1,
          reporting({
            kind: 'release',
            version: app.version,
            channel: 'stable'
          })
        ),
        step(world, `download-${index}`, StepLabel.download, 6, download(world))
      ]
    : []),
  step(
    world,
    `inspect-${index}`,
    StepLabel.inspect,
    1,
    reporting({
      kind: 'app',
      name: app.name,
      version: app.version,
      extensions: app.extensions
    })
  )
]

const installSteps = (
  world: FakeWorld,
  app: FakeApp,
  index: number
): ScriptedStep<FakeInstallState>[] => [
  step(
    world,
    `free-apps-${index}`,
    StepLabel.freeApps,
    1,
    freeApps(world),
    (state) => state.isFreeTeam === false || app.installedVersion !== undefined
  ),
  step(
    world,
    `provision-${index}`,
    StepLabel.provision,
    2,
    provisioning(app.extensions + 1)
  ),
  step(world, `sign-${index}`, StepLabel.sign, 4, signing(world)),
  step(world, `install-${index}`, StepLabel.install, 6, installing(world))
]

const signingSteps = (
  world: FakeWorld,
  apps: readonly FakeApp[]
): ScriptedStep<FakeInstallState>[] => {
  const newIds = apps.reduce((total, app) => total + app.extensions + 1, 0)

  return apps.length === 0
    ? []
    : [
        step(
          world,
          'certificate',
          StepLabel.certificate,
          1,
          certificate(world)
        ),
        step(
          world,
          'app-ids',
          StepLabel.appIds,
          1,
          reporting({
            kind: 'app-ids',
            created: newIds,
            reused: 0,
            left: 8 - newIds
          })
        )
      ]
}

export const fakeAppsSteps = (
  world: FakeWorld,
  apps: readonly FakeApp[],
  /** Refresh: how many apps get new profiles only, numbered after `apps`. */
  profiles = 0
): ScriptedStep<FakeInstallState>[] => {
  const profileSteps = Array.from({ length: profiles }, (_, offset) =>
    step(
      world,
      `profiles-${apps.length + offset}`,
      StepLabel.refreshProfiles,
      2,
      reporting({ kind: 'profiles', count: 1 })
    )
  )

  return [
    step(world, 'device', StepLabel.device, 1, checkDevice(world)),
    ...apps.flatMap((app, index) => prepareSteps(world, app, index)),
    step(world, 'sign-in', StepLabel.signIn, 1, signIn(world)),
    step(world, 'team', StepLabel.team, 1, chooseTeam(world)),
    step(
      world,
      'register-device',
      StepLabel.registerDevice,
      1,
      reporting({ kind: 'device-registration', isNew: false })
    ),
    ...signingSteps(world, apps),
    ...apps.flatMap((app, index) => installSteps(world, app, index)),
    ...profileSteps,
    ...apps.flatMap((app, index) =>
      app.name.includes('SideStore')
        ? [
            step(
              world,
              `pairing-${index}`,
              StepLabel.pairing,
              1,
              reporting({ kind: 'pairing', apps: [app.name] })
            )
          ]
        : []
    ),
    step(world, 'remember', StepLabel.remember, 1, quick)
  ]
}
