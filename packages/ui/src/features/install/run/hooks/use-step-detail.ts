import { useTranslation } from 'react-i18next'

import { useFormat } from '@ui/hooks/use-format.ts'
import type { StepDetail } from '@ui/state/active-run/types.ts'

const MS_PER_SECOND = 1000
const PERCENT = 100

/** A step's detail in words: "12.3 MB of 28 MB", or the automatic retry it is waiting for. */
export const useStepDetail = (
  detail: StepDetail | undefined
): string | undefined => {
  const { t } = useTranslation()
  const { fileSize } = useFormat()
  if (!detail) return undefined
  if (detail.kind === 'retrying')
    return t('install.run.detail.retrying', {
      attempt: detail.attempt + 1,
      seconds: Math.ceil(detail.delayMs / MS_PER_SECOND)
    })
  if (detail.kind === 'installing')
    return t('install.run.percent', { fraction: detail.percent / PERCENT })
  if (detail.kind === 'provisioning')
    return t('install.run.live.count', {
      done: detail.done,
      total: detail.total
    })
  if (detail.total === undefined)
    return t('install.run.detail.received', {
      received: fileSize(detail.received)
    })
  return t('install.run.detail.bytes', {
    received: fileSize(detail.received),
    total: fileSize(detail.total)
  })
}
