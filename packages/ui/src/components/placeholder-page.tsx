import { Card } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { compact } from '@loadstar/kernel'
import { PageHeader } from '@ui/components/page-header.tsx'
import type { TranslationKey } from '@ui/i18n/setup/i18next-types.ts'

type PlaceholderPageProps = {
  titleKey: TranslationKey
  descriptionKey?: TranslationKey
  /** What the section already shows, under the header. */
  children?: ReactNode
}

/** A section's page until its feature lands: the header and an "under construction" note. */
export const PlaceholderPage = ({
  titleKey,
  descriptionKey,
  children
}: PlaceholderPageProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader {...compact({ titleKey, descriptionKey })} />
      {children}
      <Card>
        <Card.Content>
          <p className="text-muted">{t('placeholder.body')}</p>
        </Card.Content>
      </Card>
    </div>
  )
}
