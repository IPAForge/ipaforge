import { Button } from '@heroui/react'
import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SPOT_PADDING,
  tourStopKeys,
  tourStops
} from '@ui/features/tour/constants.ts'
import { useTargetBox } from '@ui/features/tour/hooks/use-target-box.ts'
import { coachPosition } from '@ui/features/tour/utils/coach-position.ts'

type TourCoachProps = {
  stop: number
  onShow: (stop: number | undefined) => void
}

/**
 * One stop of the tour: the page dimmed but for what it points at, and a note beside it with Skip tour, Back and
 * Next (Done at the last stop). Escape closes it.
 */
export const TourCoach = ({ stop, onShow }: TourCoachProps) => {
  const { t } = useTranslation()
  const titleId = useId()
  const target = tourStops[stop] ?? 'install'
  const keys = tourStopKeys[target]
  const box = useTargetBox(target)
  const isLast = stop === tourStops.length - 1
  const onClose = () => onShow(undefined)
  const onBack = () => onShow(stop - 1)
  const onNext = () => onShow(isLast ? undefined : stop + 1)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onShow(undefined)
    }
    globalThis.addEventListener('keydown', onKey)

    return () => globalThis.removeEventListener('keydown', onKey)
  }, [onShow])
  const viewport = {
    width: globalThis.innerWidth,
    height: globalThis.innerHeight
  }
  const position = box ? coachPosition(box, viewport) : { top: 96, left: 96 }

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden="true" />
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-xl shadow-[0_0_0_4px_var(--accent),0_0_0_9999px_rgb(0_0_0/0.45)]"
          style={{
            top: box.top - SPOT_PADDING,
            left: box.left - SPOT_PADDING,
            width: box.width + 2 * SPOT_PADDING,
            height: box.height + 2 * SPOT_PADDING
          }}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed z-50 flex w-80 max-w-[calc(100%-2rem)] flex-col gap-2 rounded-2xl bg-surface p-4 shadow-lg"
        style={position}
      >
        <h2 id={titleId} className="font-semibold">
          {t(keys.title)}
        </h2>
        <p className="text-muted text-sm">{t(keys.text)}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="me-auto text-muted text-xs tabular-nums">
            {t('tour.count', { current: stop + 1, total: tourStops.length })}
          </span>
          <Button size="sm" variant="ghost" onPress={onClose}>
            {t('tour.skip')}
          </Button>
          {stop > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              data-tour-action="back"
              onPress={onBack}
            >
              {t('tour.back')}
            </Button>
          ) : null}
          <Button size="sm" autoFocus data-tour-action="next" onPress={onNext}>
            {t(isLast ? 'tour.done' : 'tour.next')}
          </Button>
        </div>
      </div>
    </>
  )
}
