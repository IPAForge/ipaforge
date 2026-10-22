// device-probe commands for the iOS 17.4+ device tunnel: rsd-services (what the device offers inside it) and
// tunnel-install (an upload and an install with every service through it, timed, optionally against the classic
// path).
import { randomBytes } from 'node:crypto'

import { nodeFileSource } from '@desktop/main/adapters/file-source.ts'
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import {
  type DeviceHandle,
  type InstallIpaProgress,
  type RsdService,
  Service,
  SHIM_SUFFIX,
  type TcpStats,
  XpcUuid,
  type XpcValue
} from '@ipaforge/device'

const STAGING = 'PublicStaging'
const MIB = 1024 * 1024
const DEFAULT_MB = 100

/** Device properties RSD sends that identify this one device: never printed. */
const REDACTED = new Set([
  'SerialNumber',
  'EthernetMacAddress',
  'WiFiMacAddress',
  'BluetoothMacAddress',
  'UniqueChipID',
  'ChipID',
  'DieID',
  'ECID',
  'IMEI',
  'MEID'
])

const printable = (value: XpcValue): string => {
  if (value instanceof Uint8Array) return `<${value.length} bytes>`
  if (value instanceof XpcUuid || value instanceof Date) return String(value)
  return JSON.stringify(value, (_, item: unknown) =>
    typeof item === 'bigint' ? `${item}n` : item
  )
}

const describeService = (service: RsdService): string => {
  const kind = service.usesRemoteXpc ? 'xpc ' : 'shim'
  const entitlement = service.entitlement ? `  [${service.entitlement}]` : ''

  return `  ${String(service.port).padStart(5)}  ${kind}  ${service.name}${entitlement}`
}

const describeStats = (stats: TcpStats): string =>
  `${stats.segmentsOut} segments out, ${stats.segmentsIn} in, ${stats.retransmits} retransmitted, ` +
  `${stats.timeouts} timeouts, ${stats.ignoredPackets} other packets ignored`

const seconds = (since: number): number => (performance.now() - since) / 1000

const rate = (bytes: number, time: number): string =>
  `${(bytes / MIB).toFixed(1)} MiB in ${time.toFixed(2)} s = ${(bytes / MIB / time).toFixed(1)} MiB/s`

/** rsd-services: opens the tunnel and prints the device's properties and services inside it. */
export const rsdServicesCommand =
  ({ withDevice, show }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      const started = performance.now()
      const tunnel = await handle.session.tunnel()
      console.log(
        `tunnel open in ${Math.round(seconds(started) * 1000)} ms: MTU ${tunnel.mtu}, ${tunnel.services.size} services`
      )

      console.log('\nproperties:')
      for (const [key, value] of Object.entries(tunnel.properties).sort(
        ([a], [b]) => a.localeCompare(b)
      )) {
        const shown =
          key === 'UniqueDeviceID' && typeof value === 'string'
            ? show(value)
            : printable(value)
        console.log(`  ${key}: ${REDACTED.has(key) ? '<redacted>' : shown}`)
      }

      console.log('\nservices:')
      const services = [...tunnel.services.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      for (const service of services) console.log(describeService(service))

      console.log("\nIPAForge's services through the tunnel:")
      for (const name of Object.values(Service)) {
        const shim = `${name}${SHIM_SUFFIX}`
        console.log(`  ${tunnel.services.has(shim) ? 'yes' : 'NO '}  ${shim}`)
      }
    }, 'tunnel')

/** Seconds to write `data` to a new file in PublicStaging, removed after. */
const timeUpload = async (
  handle: DeviceHandle,
  data: Uint8Array
): Promise<number> => {
  const afc = await handle.openMedia()
  const path = `${STAGING}/ipaforge-tunnel-speed-${Date.now()}.bin`
  try {
    if (!(await afc.exists(STAGING))) await afc.mkdir(STAGING)
    const started = performance.now()
    await afc.writeFile(path, data)
    return seconds(started)
  } finally {
    await afc.remove(path).catch(() => undefined)
    await afc.close()
  }
}

/** Installs `path` (already signed) and returns the upload's and the install's seconds. */
const timeInstall = async (handle: DeviceHandle, path: string) => {
  const started = performance.now()
  let uploaded: number | undefined
  let last = ''
  await handle.installIpa(await nodeFileSource(path), {
    onProgress: ({ stage, stagePercent, status }: InstallIpaProgress) => {
      if (stage !== 'uploading') uploaded ??= seconds(started)
      const line = [`  ${stage} ${stagePercent}%`, status]
        .filter(Boolean)
        .join(' ')
      if (stage === 'installing' && line !== last) console.log(line)
      last = line
    }
  })
  const total = seconds(started)

  return { upload: uploaded ?? total, install: total - (uploaded ?? total) }
}

/** The same upload (and install) over one route, printed. */
const measure = async (
  handle: DeviceHandle,
  data: Uint8Array,
  ipaPath: string | undefined
): Promise<void> => {
  console.log(
    `  AFC upload: ${rate(data.length, await timeUpload(handle, data))}`
  )
  if (!ipaPath) return
  const { upload, install } = await timeInstall(handle, ipaPath)
  console.log(
    `  install of ${ipaPath}: upload ${upload.toFixed(2)} s, install ${install.toFixed(2)} s`
  )
}

/**
 * tunnel-install [<signed.ipa>] [--mb 100] [--compare]: through the tunnel, a timed upload of random bytes to
 * PublicStaging (deleted after) and, with an IPA, an install; --compare runs the same over the classic path.
 */
export const tunnelInstallCommand =
  ({ withDevice, args }: DeviceProbe) =>
  async (): Promise<void> => {
    const mb = Number(args.option('mb') ?? DEFAULT_MB)
    const ipaPath = args.rest.find((arg) => arg.endsWith('.ipa'))
    const data = new Uint8Array(randomBytes(mb * MIB))

    await withDevice(async (handle) => {
      const started = performance.now()
      const tunnel = await handle.session.tunnel()
      console.log(
        `tunnel and RSD in ${Math.round(seconds(started) * 1000)} ms, MTU ${tunnel.mtu}`
      )
      await measure(handle, data, ipaPath)
      console.log(`  TCP: ${describeStats(tunnel.stats())}`)
    }, 'tunnel')

    if (!args.flag('compare')) return
    console.log('\nthe same over the classic path (lockdown StartService):')
    await withDevice((handle) => measure(handle, data, ipaPath), 'best')
  }
