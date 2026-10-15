// `device-probe install <signed.ipa>`: installs an already-signed IPA.
import { nodeFileSource } from '@desktop/main/adapters/file-source.ts'
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import type { InstallIpaProgress } from '@loadstar/device'

/** Prints each progress step once, when the percentage changes. */
const progressPrinter = () => {
  let last = -1

  return ({ stage, percent, status }: InstallIpaProgress) => {
    if (percent !== last)
      console.log(`${stage} ${percent}%${status ? ` ${status}` : ''}`)
    last = percent
  }
}

export const installCommand =
  ({ withDevice, args }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      const path = args.rest[0]
      if (!path) throw new Error('usage: install <signed.ipa>')
      await handle.installIpa(await nodeFileSource(path), {
        onProgress: progressPrinter()
      })
    })
