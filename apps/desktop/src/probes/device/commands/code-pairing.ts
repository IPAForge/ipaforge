// device-probe tv-browse and tv-pair: Apple TV and Apple Vision Pro, paired by the code they show (no cable).
// tv-browse lists the devices showing their pairing screen. tv-pair [--name <name>] pairs with one (the code is
// typed here), then finds it again on the network and opens a session through its tunnel, as the app does. This
// run's secrets live in memory, so the pairing is gone when it ends; the device keeps "IPAForge" in its list.
import { createInterface } from 'node:readline/promises'

import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import type { PairableDevice } from '@ipaforge/device'

const SEARCH_MS = 10_000

/** The devices showing their pairing screen within `SEARCH_MS`. */
const searchPairable = async (
  probe: DeviceProbe
): Promise<PairableDevice[]> => {
  const found = new Map<string, PairableDevice>()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_MS)
  try {
    await probe.manager.watchPairable((event) => {
      if (event.kind === 'found') found.set(event.device.id, event.device)
      else found.delete(event.id)
    }, controller.signal)
  } finally {
    clearTimeout(timer)
  }
  return [...found.values()]
}

const describe = (device: PairableDevice): string =>
  `${device.name}  ${device.model ?? 'model not given'}  ${device.address}:${device.port}`

export const tvBrowseCommand = (probe: DeviceProbe) => async () => {
  console.log(
    `Searching for ${SEARCH_MS / 1000} s: open Settings › Remotes and Devices › Remote App and Devices (Apple TV) or Settings › General › Remote Devices (Vision Pro)…`
  )
  const devices = await searchPairable(probe)
  if (devices.length === 0) console.log('none found')
  for (const device of devices) console.log(describe(device))
}

const askCode = async (name: string): Promise<string> => {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout
  })
  try {
    return (await prompt.question(`Code shown on ${name}: `)).trim()
  } finally {
    prompt.close()
  }
}

export const tvPairCommand = (probe: DeviceProbe) => async () => {
  const { manager, args } = probe
  console.log('Searching: keep the pairing screen open on the device…')
  const wanted = args.option('name')
  const devices = await searchPairable(probe)
  const target = devices.find(
    (device) => wanted === undefined || device.name === wanted
  )
  if (!target) {
    const named = wanted === undefined ? '' : ` named ${wanted}`
    throw new Error(`no device showing its pairing screen${named}`)
  }
  console.log(`Pairing with ${describe(target)}`)
  const paired = await manager.pairByCode(target, () => askCode(target.name))
  console.log(
    `paired: ${paired.name ?? '?'} (${paired.model ?? 'model not given'})`
  )

  console.log(
    'Finding it again on the network, and opening a session through its tunnel…'
  )
  const started = Date.now()
  const handle = await manager.open(paired.udid)
  try {
    const { info, developerMode } = await handle.check()
    console.log(
      `session in ${Date.now() - started} ms: ${info.name}, ${info.productType}, ${info.productVersion} (${info.buildVersion}), Developer Mode ${developerMode}`
    )
    // A service started through the tunnel: installation_proxy, as installs use it.
    const apps = await handle.listApps()
    console.log(`installed apps listed through the tunnel: ${apps.length}`)
  } finally {
    await handle.close()
  }
}
