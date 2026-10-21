import { TourCoach } from '@ui/features/tour/components/tour-coach.tsx'
import { useGuide } from '@ui/hooks/use-guide.ts'

/** The tour over the pages, once the setup guide closes or Show me around is pressed. */
export const TourHost = () => {
  const { guide, showTourStop } = useGuide()
  if (guide.status === 'open' || guide.tourStop === undefined) return null

  return (
    <TourCoach
      key={guide.tourStop}
      stop={guide.tourStop}
      onShow={showTourStop}
    />
  )
}
