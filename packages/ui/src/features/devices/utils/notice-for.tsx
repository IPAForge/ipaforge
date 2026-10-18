import type { useTranslation } from 'react-i18next'

import { AskAgain } from '@ui/features/devices/components/ask-again.tsx'
import { DeveloperModeSteps } from '@ui/features/devices/components/developer-mode-steps.tsx'
import { UnavailableBody } from '@ui/features/devices/components/unavailable-body.tsx'
import type {
  DeviceState,
  Notice,
  NoticeBuilder,
  NoticeProps,
  Say
} from '@ui/features/devices/types.ts'

/** The notice for each state; none while checking or when the device is ready. */
const noticeBuilders = {
  checking: undefined,
  ready: undefined,
  notConnected: (say, { view }) => ({
    status: 'warning',
    title: say('devices.notice.notConnected.title', { name: view.name }),
    body: say('devices.notice.notConnected.body'),
    action: null,
    checkAgain: false
  }),
  notTrusted: (say, { udid, view }) => ({
    status: 'danger',
    title: view.isNamed
      ? say('devices.notice.notTrusted.title', { name: view.name })
      : say('devices.notice.notTrusted.titleUnnamed'),
    body: say('devices.notice.notTrusted.body'),
    action: <AskAgain udid={udid} />,
    checkAgain: false
  }),
  locked: (say, { view }) => ({
    status: 'warning',
    title: say('devices.notice.locked.title', { name: view.name }),
    body: say('devices.notice.locked.body'),
    action: null,
    checkAgain: true
  }),
  developerModeOff: (say, { view }) => ({
    status: 'warning',
    title: say('devices.notice.developerModeOff.title', { name: view.name }),
    body: <DeveloperModeSteps />,
    action: null,
    checkAgain: true
  }),
  unavailable: (say, { view }) => ({
    status: 'danger',
    title: view.isNamed
      ? say('devices.notice.unavailable.title', { name: view.name })
      : say('devices.notice.unavailable.titleUnnamed'),
    body: <UnavailableBody view={view} />,
    action: null,
    checkAgain: true
  })
} satisfies Record<DeviceState, NoticeBuilder | undefined>

/** What to tell the user about a device that isn't ready, and the one thing to press; nothing when it is ready. */
export const noticeFor = (
  t: ReturnType<typeof useTranslation>['t'],
  state: DeviceState | undefined,
  props: NoticeProps
): Notice | undefined => {
  const say: Say = (key, values) => String(t(key as never, values as never))

  return state ? noticeBuilders[state]?.(say, props) : undefined
}
