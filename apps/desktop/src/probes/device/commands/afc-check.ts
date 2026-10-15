// `device-probe afc-check`: writes, reads back and deletes a file in PublicStaging.
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import type { AfcClient } from '@loadstar/device'
import { utf8Decode, utf8Encode } from '@loadstar/kernel'

const STAGING = 'PublicStaging'

const roundTrip = async (afc: AfcClient) => {
  const path = `${STAGING}/loadstar-probe-${Date.now()}.txt`
  const text = `written by Loadstar at ${new Date().toISOString()}`
  console.log(`1. PublicStaging exists: ${await afc.exists(STAGING)}`)
  if (!(await afc.exists(STAGING))) await afc.mkdir(STAGING)
  await afc.writeFile(path, utf8Encode(text))
  console.log(`2. wrote ${path} (${text.length} bytes)`)
  const stat = await afc.stat(path)
  console.log(`3. device reports type=${stat.type} size=${stat.size}`)
  const back = utf8Decode(await afc.readFile(path))
  console.log(
    `4. read back: "${back}" → ${back === text ? 'identical' : 'DIFFERENT'}`
  )
  await afc.remove(path)
  console.log(`5. deleted; exists now: ${await afc.exists(path)}`)
}

export const afcCheckCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      const afc = await handle.openMedia()
      try {
        await roundTrip(afc)
      } finally {
        await afc.close()
      }
    })
