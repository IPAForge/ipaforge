import { useTranslation } from 'react-i18next'

const MINUTE = 60
const SECONDS_STEP = 5

/** "About 15 s left", "About 3 min left": rounded, so it doesn't flicker with every update. */
export const useTimeLeft = () => {
  const { t } = useTranslation()

  return (seconds: number): string =>
    seconds < MINUTE
      ? t('install.run.live.leftSeconds', {
          seconds: Math.max(
            SECONDS_STEP,
            Math.round(seconds / SECONDS_STEP) * SECONDS_STEP
          )
        })
      : t('install.run.live.leftMinutes', {
          minutes: Math.round(seconds / MINUTE)
        })
}
