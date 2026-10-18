import { useTranslation } from 'react-i18next'

import type { CertificateChoice } from '@ipaforge/rpc'
import {
  certificateTitleKeys,
  certificateWarningKeys
} from '@ui/features/install/prompts/constants.ts'
import type { PickOption } from '@ui/features/install/prompts/types.ts'
import { certificateOrigin } from '@ui/features/install/prompts/utils/certificate-origin.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

/**
 * The certificates as revoke choices: who made each, when it expires and what revoking it breaks. One made by
 * IPAForge elsewhere is suggested and listed first: revoking it breaks no other tool.
 */
export const useCertificateOptions = (
  certificates: readonly CertificateChoice[]
): PickOption[] => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const options = certificates.map((certificate): PickOption => {
    const origin = certificateOrigin(certificate)
    const warningKey = Object.hasOwn(certificateWarningKeys, origin)
      ? certificateWarningKeys[origin as keyof typeof certificateWarningKeys]
      : undefined

    return {
      value: certificate.serialNumber,
      title: t(certificateTitleKeys[origin], {
        machine: certificate.machineName
      }),
      description: certificate.expiresAt
        ? t('prompts.revoke.expires', {
            date: date(new Date(certificate.expiresAt))
          })
        : undefined,
      warning: warningKey ? t(warningKey) : undefined,
      isSuggested: origin === 'ipaforge'
    }
  })

  return [
    ...options.filter((option) => option.isSuggested),
    ...options.filter((option) => !option.isSuggested)
  ]
}
