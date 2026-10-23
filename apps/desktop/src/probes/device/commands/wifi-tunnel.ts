// device-probe rp-tunnel [--mb 20]: the iOS 17.4+ tunnel over Wi-Fi. It makes (or checks) the remote pairing over
// usbmuxd, then opens the tunnel with it (remote pairing on the network, IPAForge's own TLS-PSK, the CDTunnel
// handshake, the tunnel's TCP client and RSD), and times an upload through the tunnel's AFC (written, then deleted).
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import { createProbeLogger } from '@desktop/probes/shared/logger.ts'
import { createAfcClient } from '@ipaforge/device'

const STAGING = 'PublicStaging'
const MIB = 1024 * 1024

export const wifiTunnelCommand =
  ({ withDevice, manager, args }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      console.log('Remote pairing (unlock the device; tap Trust if asked)…')
      const { how } = await handle.remotePairing({
        onAwaitingConsent: () =>
          console.log('  waiting for Trust on the device')
      })
      console.log(`  ${how}`)
      const started = Date.now()
      const tunnel = await manager.openWifiTunnel(handle.device.udid)
      try {
        console.log(
          `tunnel and RSD over Wi-Fi in ${Date.now() - started} ms, MTU ${tunnel.mtu}, ${tunnel.services.size} services`
        )
        const link = await tunnel.openShim('com.apple.afc')
        if (!link) throw new Error('no AFC in the tunnel')
        const afc = createAfcClient(link, {
          logger: createProbeLogger(),
          maxMessageBytes: 64 * MIB,
          writeChunkBytes: MIB,
          readChunkBytes: MIB
        })
        const data = new Uint8Array(MIB)
        for (let offset = 0; offset < MIB; offset += 65_536)
          globalThis.crypto.getRandomValues(
            data.subarray(offset, offset + 65_536)
          )
        const megabytes = Number(args.option('mb') ?? 20)
        const payload = new Uint8Array(megabytes * MIB)
        for (let offset = 0; offset < payload.length; offset += MIB)
          payload.set(data, offset)
        const path = `${STAGING}/ipaforge-wifi-tunnel-${Date.now()}.bin`
        try {
          if (!(await afc.exists(STAGING))) await afc.mkdir(STAGING)
          const upload = performance.now()
          await afc.writeFile(path, payload)
          const seconds = (performance.now() - upload) / 1000
          console.log(
            `  AFC upload: ${megabytes} MiB in ${seconds.toFixed(2)} s = ${(megabytes / seconds).toFixed(1)} MiB/s`
          )
        } finally {
          await afc.remove(path).catch(() => undefined)
          await afc.close()
        }
        const stats = tunnel.stats()
        console.log(`  TCP: ${JSON.stringify(stats)}`)
      } finally {
        await tunnel.close()
      }
    })
