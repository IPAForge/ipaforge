import { Button } from '@heroui/react'
import { ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type JumpToLatestProps = { unseen: number; onJump: () => void }

/** Shown while scrolled up when new lines arrived below. */
export const JumpToLatest = ({ unseen, onJump }: JumpToLatestProps) => {
  const { t } = useTranslation()

  return (
    <Button
      size="sm"
      onPress={onJump}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg rtl:translate-x-1/2"
    >
      {t('logs.jump', { count: unseen })}
      <ArrowDown aria-hidden="true" className="size-4" />
    </Button>
  )
}
