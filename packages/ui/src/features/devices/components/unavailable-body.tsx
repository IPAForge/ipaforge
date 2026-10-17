import { useTranslation } from 'react-i18next'

import { toLoadstarError } from '@loadstar/kernel'
import type { DeviceView } from '@ui/features/devices/types.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type UnavailableBodyProps = { view: DeviceView }

/** What to try for a device that can't be read, and the reason in the words for its error code. */
export const UnavailableBody = ({ view }: UnavailableBodyProps) => {
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
