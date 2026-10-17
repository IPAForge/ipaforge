import { useTranslation } from 'react-i18next'

/** Marks Install while a run goes on, so it is easy to get back to from another section. */
export const RunningBadge = () => {
  const { t } = useTranslation()

  return (
    <span
      data-testid="install-running"
      className="ms-auto flex items-center rounded-full bg-accent px-1.5 py-1"
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-accent-foreground motion-safe:animate-pulse"
      />
      <span className="sr-only">{t('nav.installRunning')}</span>
    </span>
  )
}
