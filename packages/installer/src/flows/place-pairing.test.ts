import { describe, expect, it } from 'vitest'

import { ACCOUNT, UDID } from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { PairingTarget } from '@ipaforge/device'

const target = (
  bundleId: string,
  path: string,
  appName: string
): PairingTarget => ({ bundleId, path, appName })

const pairingTargets = [
  target(
    'com.SideStore.SideStore.TEAM000001',
    'Documents/PairingFile_Lockdown.plist',
    'SideStore'
  ),
  target(
    'com.SideStore.SideStore.TEAM000001',
    'Documents/Legacy.mobiledevicepairing',
    'SideStore'
  ),
  target('com.stik.stikdebug', 'Documents/pairingFile.plist', 'StikDebug')
]

describe('placePairing', () => {
  it('asks which apps get the pairing file and places it there', async () => {
    const h = createHarness({ device: { pairingTargets } })
    const prompts = scripted({
      [PromptKind.ChoosePairingApps]: () => ['com.stik.stikdebug']
    })
    const result = await h.engine.placePairing(
      { udid: UDID, accountId: ACCOUNT },
      { onPrompt: prompts }
    ).result
    expect(prompts.asked[0]?.data?.apps).toEqual([
      { bundleId: 'com.SideStore.SideStore.TEAM000001', appName: 'SideStore' },
      { bundleId: 'com.stik.stikdebug', appName: 'StikDebug' }
    ])
    expect(result.status === 'completed' && result.state.placed).toEqual([
      pairingTargets[2]
    ])
  })

  it('keeps existing files when asked to, without prompting for given apps', async () => {
    const h = createHarness({ device: { pairingTargets } })
    const prompts = scripted()
    await h.engine.placePairing(
      {
        udid: UDID,
        accountId: ACCOUNT,
        bundleIds: ['com.SideStore.SideStore.TEAM000001'],
        overwrite: 'keep-existing'
      },
      { onPrompt: prompts }
    ).result
    expect(prompts.asked).toEqual([])
    expect(h.devices.calls.placed).toEqual([
      [
        {
          bundleId: pairingTargets[0]?.bundleId,
          path: pairingTargets[0]?.path,
          appName: 'SideStore'
        }
      ]
    ])
  })

  it('does nothing when no pairing app is installed', async () => {
    const h = createHarness()
    const result = await h.engine.placePairing(
      { udid: UDID, accountId: ACCOUNT },
      { onPrompt: scripted() }
    ).result
    expect(result.status === 'completed' && result.state.placed).toEqual([])
    expect(h.devices.calls.placed).toEqual([])
  })
})
