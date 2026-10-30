// Pairing an Apple TV or Apple Vision Pro: it has no cable, so it's paired over the network with the code it shows.
// While its pairing screen is open (Remote App and Devices, Remote Devices) it advertises
// `_remotepairing-manual-pairing._tcp`; pair-setup there takes the code as SRP's PIN. The remote pairing is saved
// like an iPhone's, and the device remembered as paired by code, so the network search knows to look for it.
import type { DeviceContext } from '@device/application/context.ts'
import {
  newHostIdentity,
  savedRecord
} from '@device/application/remote-pairing.ts'
import {
  CODE_PAIRED_KEY,
  parseCodePaired,
  serializeCodePaired
} from '@device/domain/code-paired.ts'
import { shortUdid } from '@device/domain/device.ts'
import {
  remotePairingSecretKey,
  serializeRemotePairing
} from '@device/domain/remote-pairing/record.ts'
import type {
  CodePairedDevice,
  PairableDevice,
  PairableEvent
} from '@device/domain/types.ts'
import { withClient } from '@device/infrastructure/closeable.ts'
import { createLink } from '@device/infrastructure/framing/link.ts'
import { browseService } from '@device/infrastructure/mdns/browser.ts'
import { MANUAL_PAIRING_SERVICE } from '@device/infrastructure/mdns/constants.ts'
import type { WifiAdvert } from '@device/infrastructure/mdns/types.ts'
import { createPairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import { pairSetup } from '@device/infrastructure/remote-pairing/pair-setup.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const randomBytes = (length: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

/** The device went away before pairing finished: most often its pairing screen was closed. */
const GONE: ReadonlySet<string> = new Set([
  ErrorCode.DeviceDisconnected,
  ErrorCode.DeviceNotFound,
  ErrorCode.DeviceTimeout
])

/** The name an advert's instance carries when its TXT gives none (`Living Room._remotepairing…` → `Living Room`). */
const nameOf = (advert: WifiAdvert): string =>
  advert.name ?? advert.instance.split('.')[0] ?? advert.instance

const pairableOf = (advert: WifiAdvert): PairableDevice | undefined =>
  advert.port === undefined
    ? undefined
    : {
        id: advert.instance,
        name: nameOf(advert),
        model: advert.model,
        address: advert.address,
        port: advert.port
      }

/** The devices paired by code, as remembered. */
export const codePairedDevices = async (
  ctx: DeviceContext
): Promise<CodePairedDevice[]> =>
  parseCodePaired(await ctx.deps.secrets.get(CODE_PAIRED_KEY))

const remember = async (
  ctx: DeviceContext,
  device: CodePairedDevice
): Promise<void> => {
  const others = (await codePairedDevices(ctx)).filter(
    (entry) => entry.udid !== device.udid
  )
  await ctx.deps.secrets.set(
    CODE_PAIRED_KEY,
    serializeCodePaired([...others, device])
  )
}

/**
 * Searches the network for devices showing their pairing screen until `signal` aborts. Ends at once when the host
 * can't search; throws `device.local_network_denied` when the OS refuses it.
 */
export const watchPairable = async (
  ctx: DeviceContext,
  onEvent: (event: PairableEvent) => void,
  signal: AbortSignal
): Promise<void> => {
  const { transport, logger, clock, sleep, config } = ctx.deps
  if (!transport.openMulticast) return
  const socket = await transport.openMulticast()
  try {
    await browseService(
      socket,
      MANUAL_PAIRING_SERVICE,
      {
        sleep,
        now: () => clock.now().getTime(),
        // Its pairing screen is open for a moment only: ask often.
        intervalMs: config.networkBrowseMs,
        logger
      },
      (event) => {
        if (event.kind === 'lost') {
          onEvent({ kind: 'lost', id: event.instance })
          return
        }
        const device = pairableOf(event.advert)
        if (device) onEvent({ kind: 'found', device })
      },
      signal
    )
  } finally {
    await socket.close()
  }
}

/**
 * Pairs with a device showing its pairing screen: `askPin` is called once it shows its code. A wrong code throws
 * `device.pairing_code_wrong` (try again: the device shows a new one), too many `device.pairing_backoff`, and a
 * device that went away `device.pairing_screen_closed`.
 */
export const pairByCode = async (
  ctx: DeviceContext,
  target: PairableDevice,
  askPin: () => Promise<string>
): Promise<CodePairedDevice> => {
  const { connectTcp } = ctx.deps.transport
  if (!connectTcp)
    throw new IPAForgeError(ErrorCode.DeviceNotFound, {
      message: 'this host cannot connect to devices on the network'
    })
  const host = newHostIdentity()
  try {
    const link = createLink(await connectTcp(target.address, target.port))
    const { record, peer } = await withClient(
      createPairingChannel(link),
      (channel) => pairSetup(channel, { host, randomBytes, askPin })
    )
    // Pairing gives the UDID; a device that left it out is known by its identifier.
    const udid = peer.udid ?? record.deviceIdentifier
    const device: CodePairedDevice = {
      udid,
      name: peer.name ?? target.name,
      model: peer.model ?? target.model
    }
    await ctx.deps.secrets.set(
      remotePairingSecretKey(udid),
      serializeRemotePairing(record)
    )
    await remember(ctx, device)
    ctx.deps.logger.info('paired by code', {
      device: shortUdid(udid),
      model: device.model
    })

    return device
  } catch (error) {
    if (error instanceof IPAForgeError && GONE.has(error.code))
      throw new IPAForgeError(ErrorCode.PairingScreenClosed, { cause: error })
    throw error
  }
}

/** Forgets a device paired by code: its remote pairing and its place in the list. Apps on it stay. */
export const forgetCodePaired = async (
  ctx: DeviceContext,
  udid: string
): Promise<void> => {
  const { secrets, logger } = ctx.deps
  const others = (await codePairedDevices(ctx)).filter(
    (entry) => entry.udid !== udid
  )
  await secrets.set(CODE_PAIRED_KEY, serializeCodePaired(others))
  if (await savedRecord(ctx, udid))
    await secrets.delete(remotePairingSecretKey(udid))
  ctx.network.delete(udid)
  logger.info('forgot a device paired by code', { device: shortUdid(udid) })
}
