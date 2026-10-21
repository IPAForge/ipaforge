import { useTranslation } from 'react-i18next'

import { AUTHOR, COPYRIGHT_YEAR } from '@ui/components/shell/constants.ts'

/** Who made IPAForge, at the foot of the sidebar. */
export const AppCredit = () => {
  const { t } = useTranslation()

  return (
    <footer className="flex flex-col gap-0.5 px-3 pt-3 text-muted text-xs">
      <p>{t('shell.credit.madeWith')}</p>
      <p>
        {t('shell.credit.copyright', { year: COPYRIGHT_YEAR, name: AUTHOR })}
      </p>
    </footer>
  )
}
