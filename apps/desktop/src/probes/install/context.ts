// What every install-probe command works with: the desktop Engine, the parsed command line, the terminal prompt,
// and helpers to pick the device and the saved account.
import { createDesktopEngine } from '@desktop/main/engine.ts'
import type { InstallProbeArgs } from '@desktop/probes/install/args.ts'
import { createProbeLogger } from '@desktop/probes/shared/logger.ts'
import { createPrompt } from '@desktop/probes/shared/prompt.ts'
import {
  createProbeSecrets,
  PROBE_DATA_DIR
} from '@desktop/probes/shared/secrets.ts'
import type { Prompt } from '@desktop/probes/shared/types.ts'
import { shortUdid } from '@loadstar/device'
import type { Engine } from '@loadstar/installer'

export type InstallProbe = {
  readonly engine: Engine
  readonly prompt: Prompt
  readonly args: InstallProbeArgs
  /** A UDID as printed: shortened unless --show-udid is given. */
  readonly show: (udid: string) => string
  /** The device named by --udid, or the first one connected. */
  readonly pickUdid: () => Promise<string>
  /** The saved account named by --account, the only one, or the one the user picks. */
  readonly pickAccount: () => Promise<string>
  /** Write commands run only with --yes. */
  readonly requireYes: (what: string) => void
}

const pickUdid = async (
  engine: Engine,
  args: InstallProbeArgs
): Promise<string> => {
  const devices = await engine.listDevices()
  const wanted = args.option('udid')
  const device = wanted
    ? devices.find((candidate) => candidate.udid === wanted)
    : devices[0]
  if (!device)
    throw new Error(
      wanted ? 'that device is not connected' : 'no device connected'
    )
  return device.udid
}

const pickAccount = async (
  engine: Engine,
  args: InstallProbeArgs,
  prompt: Prompt
): Promise<string> => {
  const wanted = args.option('account')
  if (wanted) return wanted
  const accounts = await engine.listAccounts()
  const [only] = accounts
  if (!only)
    throw new Error(
      'no saved Apple account; sign in first with `apple-probe signin`'
    )
  if (accounts.length === 1) return only.id
  for (const [i, account] of accounts.entries())
    console.log(`  ${i + 1}. ${account.appleId}`)
  const choice =
    accounts[
      Number(await prompt.ask(`Account [1-${accounts.length}] (default 1): `)) -
        1
    ]

  return (choice ?? only).id
}

const requireYes = (args: InstallProbeArgs) => (what: string) => {
  if (args.flag('yes')) return
  throw new Error(
    `${what} writes to Apple and the device; run it again with --yes`
  )
}

export const createInstallProbe = (args: InstallProbeArgs): InstallProbe => {
  const { secrets } = createProbeSecrets()
  const engine = createDesktopEngine({
    secrets,
    dataDir: PROBE_DATA_DIR,
    logger: createProbeLogger('  ')
  })
  const prompt = createPrompt()
  const showUdid = args.flag('show-udid')

  return {
    engine,
    prompt,
    args,
    show: (udid) => (showUdid ? udid : shortUdid(udid)),
    pickUdid: () => pickUdid(engine, args),
    pickAccount: () => pickAccount(engine, args, prompt),
    requireYes: requireYes(args)
  }
}
