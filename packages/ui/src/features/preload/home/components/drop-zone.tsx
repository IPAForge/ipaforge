import { Button } from '@heroui/react'
import { Link2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type DropZoneProps = {
  isOver: boolean
  isChoosing: boolean
  onChoose: () => void
  onLink: () => void
}

/** Where to drop .ipa files (anywhere on the window works; this lights up), or choose them, or add a link. */
export const DropZone = ({
  isOver,
  isChoosing,
  onChoose,
  onLink
}: DropZoneProps) => {
  const { t } = useTranslation()

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${isOver ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
    >
      <Upload aria-hidden="true" className="size-7 text-muted" />
      <p className="font-semibold">{t('preload.add.drop')}</p>
      <p className="text-muted text-sm">{t('preload.add.or')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" isPending={isChoosing} onPress={onChoose}>
          {t('preload.add.choose')}
        </Button>
        <Button variant="secondary" onPress={onLink}>
          <Link2 aria-hidden="true" className="size-4" />
          {t('preload.add.link')}
        </Button>
      </div>
    </div>
  )
}
