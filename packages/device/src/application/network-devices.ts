// Devices on the local network, reached without usbmuxd: the adverts a search finds, matched to devices this
// computer knows, as attached and detached events. iPhones and iPads by their lockdown advert (the authTag against
// each pair record's HostID on iOS 26.4 and later, else the MAC address in the advert's name); Apple TVs and Vision
// Pros paired by code by their remote pairing advert (its authTag against each one's identity resolving key). Each
// gets a negative device id, the same for as long as it stays.
import { codePairedDevices } from '@device/application/code-pairing.ts'
import type { DeviceContext } from '@device/application/context.ts'
import { getPairRecord } from '@device/application/pair-records.ts'
import { savedRecord } from '@device/application/remote-pairing.ts'
import { knownWifiDevices } from '@device/application/wifi.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { DeviceEvent, UsbmuxDevice } from '@device/domain/types.ts'
import { authTagMatches } from '@device/infrastructure/mdns/auth-tag.ts'
import {
  browseService,
  browseWifiDevices
} from '@device/infrastructure/mdns/browser.ts'
import { REMOTE_PAIRING_SERVICE } from '@device/infrastructure/mdns/constants.ts'
import { remoteAuthTagMatches } from '@device/infrastructure/mdns/remote-auth-tag.ts'
import type {
  BrowseEvent,
  WifiAdvert
} from '@device/infrastructure/mdns/types.ts'
import { toIPAForgeError } from '@ipaforge/kernel'

/** An advert carries one tag per paired computer; more than this is not a real device's. */
const MAX_AUTH_TAGS = 4

/** A stable negative id per device, so it never collides with usbmuxd's. */
const networkIdFor = (ctx: DeviceContext, udid: string): number => {
  const known = ctx.networkIds.get(udid)
  if (known !== undefined) return known
  const id = -(ctx.networkIds.size + 1)
  ctx.networkIds.set(udid, id)
  return id
}

const hostIdFor = async (
  ctx: DeviceContext,
  udid: string
): Promise<string | undefined> => {
  try {
    return (await getPairRecord(ctx, udid))?.record.hostId
  } catch (error) {
    ctx.deps.logger.debug('no pair record for a Wi-Fi match', {
      device: shortUdid(udid),
      code: toIPAForgeError(error).code
    })
    return undefined
  }
}

/**
 * The known device this advert is from, or `undefined` when it is someone else's (or not paired with us). A signed
 * advert (iOS 26.4+) is matched by its tags only; the MAC address is for adverts without them.
 */
const matchAdvert = async (
  ctx: DeviceContext,
  advert: WifiAdvert
): Promise<string | undefined> => {
  const known = await knownWifiDevices(ctx)
  if (advert.identifier && advert.authTags.length > 0) {
    for (const { udid } of known) {
      const hostId = await hostIdFor(ctx, udid)
      if (!hostId) continue
      for (const tag of advert.authTags.slice(0, MAX_AUTH_TAGS))
        if (await authTagMatches(hostId, advert.identifier, tag)) return udid
    }
    // A device that signs its advert signs it for every computer it's paired with: no tag of ours, not ours.
    return undefined
  }
  return known.find(
    (device) => device.mac !== undefined && device.mac === advert.mac
  )?.udid
}

/** The device paired by code this remote pairing advert is from, or `undefined` when it isn't one of them. */
const matchCodePaired = async (
  ctx: DeviceContext,
  advert: WifiAdvert
): Promise<string | undefined> => {
  const { identifier } = advert
  if (!identifier || advert.authTags.length === 0) return undefined
  for (const { udid } of await codePairedDevices(ctx)) {
    const record = await savedRecord(ctx, udid)
    if (!record) continue
    for (const tag of advert.authTags.slice(0, MAX_AUTH_TAGS))
      if (remoteAuthTagMatches(record.altIrk, identifier, tag)) return udid
  }
  return undefined
}

/**
 * Searches the network until `signal` aborts, keeping `ctx.network` current and reporting each device as it comes
 * and goes. Ends at once when the host can't search the network; throws `device.local_network_denied` when the OS
 * refuses it.
 */
export const watchNetworkDevices = async (
  ctx: DeviceContext,
  onEvent: (event: DeviceEvent) => void,
  signal: AbortSignal
): Promise<void> => {
  const { transport, logger, clock, sleep, config } = ctx.deps
  if (!transport.openMulticast || !transport.connectTcp) return
  const socket = await transport.openMulticast()
  const byInstance = new Map<string, string>()
  // Matching an advert reads pair records; a search that stops waits for the matches still running.
  const matching = new Set<Promise<void>>()

  const found = async (advert: WifiAdvert, byCode: boolean) => {
    const udid = byCode
      ? await matchCodePaired(ctx, advert)
      : await matchAdvert(ctx, advert)
    if (!udid) {
      logger.debug(
        'a device on the network that this computer is not paired with',
        {
          instance: advert.instance
        }
      )
      return
    }
    byInstance.set(advert.instance, udid)
    const device: UsbmuxDevice = {
      udid,
      deviceId: networkIdFor(ctx, udid),
      connectionType: 'network',
      address: advert.address,
      ...(byCode ? { pairedByCode: true as const } : {})
    }
    ctx.network.set(udid, device)
    logger.info('found on Wi-Fi', { device: shortUdid(udid) })
    onEvent({ kind: 'attached', device })
  }

  const lost = (instance: string) => {
    const udid = byInstance.get(instance)
    if (!udid) return
    byInstance.delete(instance)
    ctx.network.delete(udid)
    logger.info('gone from Wi-Fi', { device: shortUdid(udid) })
    onEvent({ kind: 'detached', deviceId: networkIdFor(ctx, udid), udid })
  }

  const onBrowse = (byCode: boolean) => (event: BrowseEvent) => {
    if (event.kind === 'lost') {
      lost(event.instance)
      return
    }
    const match = found(event.advert, byCode).catch((error: unknown) =>
      logger.warn('a device on the network could not be matched', {
        code: toIPAForgeError(error).code
      })
    )
    matching.add(match)
    void match.finally(() => matching.delete(match))
  }
  const options = {
    sleep,
    now: () => clock.now().getTime(),
    intervalMs: config.networkQueryIntervalMs,
    logger
  }

  try {
    // Devices paired by code advertise no lockdown, only their remote pairing; one paired while this search runs
    // is found by it too.
    await Promise.all([
      browseWifiDevices(socket, options, onBrowse(false), signal),
      browseService(
        socket,
        REMOTE_PAIRING_SERVICE,
        options,
        onBrowse(true),
        signal
      )
    ])
  } finally {
    await Promise.all(matching)
    for (const udid of byInstance.values()) ctx.network.delete(udid)
    await socket.close()
  }
}

/** Searches the network for `ctx.deps.config.networkBrowseMs` and returns what it found. */
export const discoverNetworkDevices = async (
  ctx: DeviceContext
): Promise<UsbmuxDevice[]> => {
  const controller = new AbortController()
  const found: UsbmuxDevice[] = []
  const search = watchNetworkDevices(
    ctx,
    (event) => {
      if (event.kind === 'attached') found.push(event.device)
    },
    controller.signal
  )
  await Promise.race([
    search,
    ctx.deps
      .sleep(ctx.deps.config.networkBrowseMs)
      .then(() => controller.abort())
  ])
  await search.catch(() => undefined)

  return found
}
