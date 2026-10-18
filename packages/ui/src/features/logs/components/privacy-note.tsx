import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** What the logs never hold, and that they stay on this computer. */
export const PrivacyNote = () => {
  const { t } = useTranslation()

  return (
    <p className="flex items-start gap-2 text-muted text-sm">
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t('logs.privacy')}
    </p>
  )
}
