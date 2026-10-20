import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  WHATS_NEW_LINK_CLASSES,
  WHATS_NEW_PATH
} from '@ui/features/whats-new/constants.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/** The changelog, at the foot of the sidebar, on one line with the version IPAForge runs. */
export const WhatsNewLink = () => {
  const { t } = useTranslation()
  const { appVersion } = useUiServices()

  return (
    <Link to={WHATS_NEW_PATH} className={WHATS_NEW_LINK_CLASSES}>
      <Sparkles aria-hidden="true" className="size-4 shrink-0" />
      <span className="shrink-0">{t('whatsNew.link')}</span>
      <span className="ms-auto min-w-0 truncate text-[11px] text-muted tabular-nums">
        {appVersion}
      </span>
    </Link>
  )
}
