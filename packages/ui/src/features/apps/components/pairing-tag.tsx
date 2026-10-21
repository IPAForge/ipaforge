import { useTranslation } from 'react-i18next'

type PairingTagProps = {
  name: string
  onOpen: () => void
}

/** On an app that can't reach the device by itself: "No pairing file ›", which opens Pairing files at it. */
export const PairingTag = ({ name, onOpen }: PairingTagProps) => {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('apps.pairing.tagOne', { name })}
      className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning-soft-foreground text-xs hover:underline focus-visible:outline-2 focus-visible:outline-focus"
    >
      {t('apps.pairing.tag')}
    </button>
  )
}
