// device-probe rp-pair: makes a remote pairing (iOS 17.4 and later) with the device, then verifies it, printing
// what SideStore's remote pairing file would hold, without the private key. Secrets stay in this run's memory.
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import { toHex } from '@ipaforge/kernel'

export const remotePairCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      console.log(
        'Making a remote pairing (the iPhone may ask to Trust this computer)…'
      )
      const started = Date.now()
      const { record, how } = await handle.remotePairing({
        onAwaitingConsent: () =>
          console.log('The device asks for consent: unlock it and tap Trust.')
      })
      console.log(`${how} in ${Date.now() - started} ms`)
      console.log(`  host identifier:   ${record.identifier}`)
      console.log(`  host public key:   ${toHex(record.publicKey)}`)
      console.log(`  device identifier: ${record.deviceIdentifier}`)
      console.log(`  device alt_irk:    ${toHex(record.altIrk)}`)
      console.log('Verifying it (pair-verify)…')
      console.log(`  ${(await handle.checkRemotePairing()).state}`)
    })
