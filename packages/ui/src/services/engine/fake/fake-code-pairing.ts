// Apple TVs and Vision Pros for the fake Engine: both show their pairing screen in every scenario (found a moment
// after the search starts), pair with FAKE_PAIRING_CODE, and join the device feed once paired. `paired-tv` starts
// with both paired (the Vision Pro off the network, its Developer Mode off), `tv-updated` with the TV refusing its
// pairing (as after a tvOS update), `pairing-backoff` makes the TV wait after one wrong code, and
// `pairing-screen-closed` closes its screen while the code is asked.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { PromptKind, StepLabel } from '@ipaforge/rpc'
import {
  FAKE_PAIRING_CODE,
  fakeCodePaired,
  fakePairable
} from '@ui/services/engine/fake/fake-data.ts'
import { startScriptedRun } from '@ui/services/engine/fake/scripted-run.ts'
import type {
  FakeCodePairing,
  FakeCodePairingOptions
} from '@ui/services/engine/fake/types.ts'
import type { CodePairedDevice } from '@ui/services/engine/types.ts'

/** Wrong codes before a device stops taking them for a while. */
const TRIES_BEFORE_BACKOFF = 3
const BACKOFF_SECONDS = 30
/** Search rounds (of the run delay) before the pairing screens are found. */
const ROUNDS_BEFORE_FOUND = 8

const pairedOf = (model: keyof typeof fakeCodePaired): CodePairedDevice => {
  const { udid, check } = fakeCodePaired[model]

  return { udid, name: check.info.name, model }
}

export const createFakeCodePairing = ({
  scenario,
  delayMs,
  devices,
  states
}: FakeCodePairingOptions): FakeCodePairing => {
  let paired: CodePairedDevice[] = []
  const pairWith = (model: keyof typeof fakeCodePaired, trusted = true) => {
    const known = fakeCodePaired[model]
    paired = [
      ...paired.filter((device) => device.udid !== known.udid),
      pairedOf(model)
    ]
    states.add(known.check, trusted)
  }
  if (scenario === 'paired-tv' || scenario === 'tv-updated') {
    pairWith('AppleTV14,1', scenario === 'paired-tv')
    devices.plugIn(fakeCodePaired['AppleTV14,1'].device)
  }
  if (scenario === 'paired-tv') pairWith('RealityDevice14,1')
  const wait = () =>
    new Promise<void>((resolve) => setTimeout(resolve, delayMs))

  return {
    watchPairableDevices: (listener, options) => {
      if (scenario === 'local-network-denied') {
        listener({ kind: 'denied' })
        return () => undefined
      }
      const timer = setTimeout(() => {
        for (const device of fakePairable) listener({ kind: 'found', device })
      }, delayMs * ROUNDS_BEFORE_FOUND)
      const stop = () => clearTimeout(timer)
      options?.signal?.addEventListener('abort', stop, { once: true })
      return stop
    },
    pairByCode: ({ target }, options) =>
      startScriptedRun<{ readonly paired?: CodePairedDevice }>({
        pipelineId: 'pairByCode',
        steps: [
          {
            stepId: 'pair-by-code',
            labelKey: StepLabel.pairByCode,
            run: async (_state, context) => {
              const model = target.model as keyof typeof fakeCodePaired
              let wrong = 0
              for (;;) {
                // The device is reached and shows its code.
                await wait()
                const code = context.prompt<string>({
                  kind: PromptKind.PairingCode,
                  data: {
                    deviceName: target.name,
                    codeLength: FAKE_PAIRING_CODE.length,
                    retry: wrong > 0
                  }
                })
                if (scenario === 'pairing-screen-closed') {
                  // The question is left unanswered: the screen closed under it.
                  code.catch(() => undefined)
                  await wait()
                  throw new IPAForgeError(ErrorCode.PairingScreenClosed)
                }
                const typed = await code
                // The device checks it.
                await wait()
                if (typed === FAKE_PAIRING_CODE) {
                  pairWith(model)
                  devices.plugIn(fakeCodePaired[model].device)
                  return { paired: pairedOf(model) }
                }
                wrong++
                const limit =
                  scenario === 'pairing-backoff' ? 1 : TRIES_BEFORE_BACKOFF
                if (wrong >= limit)
                  throw new IPAForgeError(ErrorCode.PairingBackoff, {
                    data: { seconds: BACKOFF_SECONDS }
                  })
              }
            }
          }
        ],
        initial: {},
        options: options as never,
        delayMs
      }) as never,
    codePairedDevices: async () => paired,
    forgetCodePaired: async (udid) => {
      paired = paired.filter((device) => device.udid !== udid)
      devices.unplug(udid)
    }
  }
}
