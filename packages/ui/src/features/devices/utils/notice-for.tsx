import type { useTranslation } from 'react-i18next'

import { AskAgain } from '@ui/features/devices/components/ask-again.tsx'
import { DeveloperModeSteps } from '@ui/features/devices/components/developer-mode-steps.tsx'
import { UnavailableBody } from '@ui/features/devices/components/unavailable-body.tsx'
import type {
  DeviceState,
  Notice,
  NoticeBuilder,
  NoticeProps
} from '@ui/features/devices/types.ts'

/** The notice for each state; none while checking or when the device is ready. */
const noticeBuilders = {
  checking: undefined,
  ready: undefined,
  notConnected: (t, { view }) => ({
    status: 'warning',
    title: t('devices.notice.notConnected.title', { name: view.name }),
    body: t('devices.notice.notConnected.body'),
    action: null,
    checkAgain: false
  }),
  notTrusted: (t, { udid, view }) => ({
    status: 'danger',
    title: view.isNamed
      ? t('devices.notice.notTrusted.title', { name: view.name })
      : t('devices.notice.notTrusted.titleUnnamed'),
    body: t('devices.notice.notTrusted.body'),
    action: <AskAgain udid={udid} />,
    checkAgain: false
  }),
  locked: (t, { view }) => ({
    status: 'warning',
    title: t('devices.notice.locked.title', { name: view.name }),
    body: t('devices.notice.locked.body'),
    action: null,
    checkAgain: true
  }),
  developerModeOff: (t, { view }) => ({
    status: 'warning',
    title: t('devices.notice.developerModeOff.title', { name: view.name }),
    body: <DeveloperModeSteps />,
    action: null,
    checkAgain: true
  }),
  unavailable: (t, { view }) => ({
    status: 'danger',
    title: view.isNamed
      ? t('devices.notice.unavailable.title', { name: view.name })
      : t('devices.notice.unavailable.titleUnnamed'),
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
): Notice | undefined => (state ? noticeBuilders[state]?.(t, props) : undefined)
