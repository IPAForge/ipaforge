import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { guideSteps } from '@ui/features/guide/constants.ts'
import { useGuide } from '@ui/hooks/use-guide.ts'

/** After Finish later: how far the guide got, Continue the guide, and Not now (until IPAForge opens again). */
export const GuideBanner = () => {
  const { t } = useTranslation()
  const { guide, open, hideBanner } = useGuide()
  if (guide.status !== 'later' || guide.isBannerHidden) return null
  const done = guideSteps.filter((step) => guide.done.includes(step)).length
  const onContinue = () => open()

  return (
    <section
      aria-label={t('guide.banner.label')}
      className="flex flex-wrap items-center gap-3 border-border border-b bg-accent-soft px-4 py-2 text-accent-soft-foreground text-sm"
    >
      <p className="min-w-0 flex-1">
        {t('guide.banner.text', { done, total: guideSteps.length })}
      </p>
      <Button size="sm" variant="ghost" onPress={hideBanner}>
        {t('guide.banner.notNow')}
      </Button>
      <Button size="sm" onPress={onContinue}>
        {t('guide.banner.continue')}
      </Button>
    </section>
  )
}
