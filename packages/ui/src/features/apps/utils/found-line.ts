import type { TFunction } from 'i18next'

import type { RefreshPlan } from '@ui/features/apps/types.ts'

/** Where an app IPAForge didn't install was found: one source, one of several (to pick from), or how to add it. */
export const foundLine = (
  t: TFunction,
  refresh: RefreshPlan | undefined,
  choices: number
): string => {
  if (refresh?.kind !== 'source') return t('apps.others.how')
  if (choices > 1)
    return t('apps.others.foundMany', {
      source: refresh.from,
      count: choices - 1
    })

  return t('apps.others.found', { source: refresh.from })
}
