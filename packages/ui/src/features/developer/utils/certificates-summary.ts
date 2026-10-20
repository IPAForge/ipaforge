import type { TFunction } from 'i18next'

import { FREE_CERTIFICATE_LIMIT } from '@ui/features/developer/constants.ts'
import type { TeamCertificates } from '@ui/services/engine/types.ts'

/** How many certificates the team holds: "2 of 2 used" on a free team, a plain count on a paid one. */
export const certificatesSummary = (
  t: TFunction,
  { team, certificates }: TeamCertificates
): string =>
  team.isFree
    ? t('portal.certificates.usedFree', {
        count: certificates.length,
        max: FREE_CERTIFICATE_LIMIT
      })
    : t('portal.certificates.usedPaid', { count: certificates.length })
