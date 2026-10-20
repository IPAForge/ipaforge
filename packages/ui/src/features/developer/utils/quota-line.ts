import type { TFunction } from 'i18next'

import type { Formatters } from '@ui/i18n/formatters.ts'
import type { AppIdUsage } from '@ui/services/engine/types.ts'

/** A free team's App ID limit: "4 left this week · next one frees on Oct 26" (the soonest to stop counting). */
export const quotaLine = (
  t: TFunction,
  format: Formatters,
  usage: AppIdUsage
): string => {
  const left = t('portal.appIds.left', { count: usage.quota.available })
  const soonest = usage.appIds
    .flatMap((appId) =>
      appId.expiresAt === undefined ? [] : [new Date(appId.expiresAt)]
    )
    .filter((date) => date.getTime() > Date.now())
    .sort((a, b) => a.getTime() - b.getTime())[0]

  return soonest
    ? t('portal.appIds.leftAndNext', { left, date: format.date(soonest) })
    : left
}
