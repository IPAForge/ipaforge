// The write commands: `sidestore`, `ipa` and `pairing`. Each refuses to run without --yes.
import { nodeFileSource } from '@desktop/main/adapters/file-source.ts'
import type { InstallProbe } from '@desktop/probes/install/context.ts'
import { runCommand } from '@desktop/probes/install/run.ts'
import type { Channel } from '@ipaforge/catalog'
import type { AppFileTarget } from '@ipaforge/device'
import type { InstallState, PairingState } from '@ipaforge/installer'
import { compact } from '@ipaforge/kernel'

const CHANNELS: ReadonlySet<string> = new Set(['stable', 'nightly'])

const channelOption = (probe: InstallProbe): Channel | undefined => {
  const channel = probe.args.option('channel')
  if (channel === undefined) return undefined
  if (!CHANNELS.has(channel)) throw new Error('--channel is stable or nightly')
  return channel as Channel
}

const printInstalled = (state: InstallState): void => {
  for (const job of state.apps) {
    if (!job.installed || !job.identity) continue
    console.log(
      `  installed ${job.inspection?.app.name ?? '?'} as ${job.identity.newMainBundleId}`
    )
  }
}

const printPlaced = (placed: readonly AppFileTarget[] | undefined): void => {
  for (const target of placed ?? [])
    console.log(`  pairing file → ${target.bundleId}: ${target.path}`)
}

export const sideStoreCommand =
  (probe: InstallProbe) => async (): Promise<void> => {
    probe.requireYes('sidestore')
    const variant = probe.args.flag('livecontainer')
      ? 'livecontainer'
      : 'sidestore'
    const udid = await probe.pickUdid()
    console.log(`Installing ${variant} on ${probe.show(udid)}`)
    const input = compact({
      udid,
      accountId: await probe.pickAccount(),
      teamId: probe.args.option('team'),
      channel: channelOption(probe),
      variant: variant as 'sidestore' | 'livecontainer'
    })
    const state = await runCommand<InstallState>(probe, (options) =>
      probe.engine.installSideStore(input, options)
    )
    printInstalled(state)
    printPlaced(state.pairingPlaced)
  }

export const ipaCommand = (probe: InstallProbe) => async (): Promise<void> => {
  probe.requireYes('ipa')
  if (probe.args.rest.length === 0)
    throw new Error('usage: ipa <file.ipa…> --yes')
  const files = await Promise.all(
    probe.args.rest.map((path) => nodeFileSource(path))
  )
  const udid = await probe.pickUdid()
  console.log(`Installing ${files.length} app(s) on ${probe.show(udid)}`)
  const input = compact({
    udid,
    accountId: await probe.pickAccount(),
    teamId: probe.args.option('team'),
    apps: files.map((file) => ({ kind: 'file' as const, file }))
  })
  printInstalled(
    await runCommand<InstallState>(probe, (options) =>
      probe.engine.installApps(input, options)
    )
  )
}

export const pairingCommand =
  (probe: InstallProbe) => async (): Promise<void> => {
    probe.requireYes('pairing')
    const udid = await probe.pickUdid()
    console.log(`Placing this computer's pairing file on ${probe.show(udid)}`)
    const input = compact({
      udid,
      accountId: await probe.pickAccount(),
      overwrite: probe.args.flag('keep-existing')
        ? ('keep-existing' as const)
        : undefined
    })
    const state = await runCommand<PairingState>(probe, (options) =>
      probe.engine.placePairing(input, options)
    )
    printPlaced(state.placed)
  }
