import { Button } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { toLoadstarError } from '@loadstar/kernel'
import type { DeviceState } from '@ui/features/devices/device-state.ts'
import type { DeviceView } from '@ui/features/devices/use-device-view.ts'
import { usePairDevice } from '@ui/features/devices/use-pair-device.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type NoticeProps = {
  udid: string
  view: DeviceView
}

/** Reads the device's status again. */
export const CheckAgain = ({ udid }: { udid: string }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const onCheckAgain = () =>
    void queryClient.invalidateQueries({
      queryKey: queryKeys.deviceStatus(udid)
    })

  return (
    <Button size="sm" variant="tertiary" onPress={onCheckAgain}>
      {t('devices.checkAgain')}
    </Button>
  )
}

const AskAgain = ({ udid }: { udid: string }) => {
  const { t } = useTranslation()
  const pair = usePairDevice(udid)
  const onAskAgain = () => pair.mutate()

  return (
    <Button size="sm" onPress={onAskAgain} isPending={pair.isPending}>
      {pair.isPending
        ? t('devices.notice.notTrusted.waiting')
        : t('devices.notice.notTrusted.action')}
    </Button>
  )
}

/** What to try for a device that can't be read, and the reason in the words for its error code. */
const UnavailableBody = ({ view }: { view: DeviceView }) => {
  const { t } = useTranslation()
  const reason = view.error
    ? t(errorTitleKey(toLoadstarError(view.error).code))
    : undefined

  return (
    <span className="flex flex-col gap-1">
      <span>
        {view.isWifiOnly
          ? t('devices.notice.unavailable.bodyWifi')
          : t('devices.notice.unavailable.body')}
      </span>
      {reason ? (
        <span className="text-muted text-xs">
          {t('devices.notice.unavailable.reason', { reason })}
        </span>
      ) : null}
    </span>
  )
}

const DeveloperModeSteps = () => {
  const { t } = useTranslation()

  return (
    <ol className="list-decimal ps-5">
      <li>{t('devices.notice.developerModeOff.step1')}</li>
      <li>{t('devices.notice.developerModeOff.step2')}</li>
      <li>{t('devices.notice.developerModeOff.step3')}</li>
    </ol>
  )
}

type Notice = {
  readonly status: 'warning' | 'danger'
  readonly title: string
  readonly body: ReactNode
  /** Ask again (for Trust); null when the only thing to do is Check again. */
  readonly action: ReactNode
  readonly checkAgain: boolean
}

/** What to tell the user about a device that isn't ready, and the one thing to press; nothing when it is ready. */
const noticeFor = (
  t: ReturnType<typeof useTranslation>['t'],
  state: DeviceState | undefined,
  { udid, view }: NoticeProps
): Notice | undefined => {
  const name = view.name
  switch (state) {
    case 'notConnected':
      return {
        status: 'warning',
        title: t('devices.notice.notConnected.title', { name }),
        body: t('devices.notice.notConnected.body'),
        action: null,
        checkAgain: false
      }
    case 'notTrusted':
      return {
        status: 'danger',
        title: view.isNamed
          ? t('devices.notice.notTrusted.title', { name })
          : t('devices.notice.notTrusted.titleUnnamed'),
        body: t('devices.notice.notTrusted.body'),
        action: <AskAgain udid={udid} />,
        checkAgain: false
      }
    case 'locked':
      return {
        status: 'warning',
        title: t('devices.notice.locked.title', { name }),
        body: t('devices.notice.locked.body'),
        action: null,
        checkAgain: true
      }
    case 'developerModeOff':
      return {
        status: 'warning',
        title: t('devices.notice.developerModeOff.title', { name }),
        body: <DeveloperModeSteps />,
        action: null,
        checkAgain: true
      }
    case 'unavailable':
      return {
        status: 'danger',
        title: view.isNamed
          ? t('devices.notice.unavailable.title', { name })
          : t('devices.notice.unavailable.titleUnnamed'),
        body: <UnavailableBody view={view} />,
        action: null,
        checkAgain: true
      }
    default:
      return undefined
  }
}

const toneClasses = {
  warning: { box: 'bg-warning-soft', title: 'text-warning' },
  danger: { box: 'bg-danger-soft', title: 'text-danger' }
} as const

/** A tinted box: the title in the tone's colour, what to do, and its buttons under the text. */
const NoticeBox = ({
  status,
  title,
  body,
  action
}: {
  status: Notice['status']
  title: string
  body: ReactNode
  action?: ReactNode
}) => (
  <div
    role="status"
    className={`flex flex-col gap-1 rounded-xl px-4 py-3 text-sm ${toneClasses[status].box}`}
  >
    <p className={`font-medium ${toneClasses[status].title}`}>{title}</p>
    <div className="text-muted">{body}</div>
    {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
  </div>
)

type DeviceNoticeProps = NoticeProps & {
  /** Off where the device's card already has Check again next to its name. */
  showCheckAgain?: boolean
}

/** A device that isn't ready: what is wrong, how to fix it, and Check again (or Ask again for Trust). */
export const DeviceNotice = ({
  showCheckAgain = true,
  ...props
}: DeviceNoticeProps) => {
  const { t } = useTranslation()
  const notice = noticeFor(t, props.view.state, props)
  if (!notice) return null
  const checkAgain =
    notice.checkAgain && showCheckAgain ? (
      <CheckAgain udid={props.udid} />
    ) : null

  return (
    <NoticeBox
      status={notice.status}
      title={notice.title}
      body={notice.body}
      action={notice.action ?? checkAgain}
    />
  )
}

/** No device connected at all. */
export const NoDeviceNotice = () => {
  const { t } = useTranslation()

  return (
    <NoticeBox
      status="warning"
      title={t('devices.notice.none.title')}
      body={t('devices.notice.none.body')}
    />
  )
}
