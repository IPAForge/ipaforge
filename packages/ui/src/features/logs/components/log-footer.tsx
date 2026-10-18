import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { LOG_BUFFER_CAPACITY } from '@loadstar/kernel'
import { DebugDetailsSwitch } from '@ui/features/logs/components/debug-details-switch.tsx'
import type { FollowState } from '@ui/features/logs/types.ts'

type LogFooterProps = {
  follow: FollowState
  matching: number
  onPause: () => void
  onFollow: () => void
}

/** Whether new lines are followed, how many lines match, and the debug switch. */
export const LogFooter = ({
  follow,
  matching,
  onPause,
  onFollow
}: LogFooterProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-3 border-border border-t px-3 py-2 text-muted text-xs">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${follow.isFollowing ? 'animate-pulse bg-success' : 'bg-muted'}`}
        />
        {t(follow.isFollowing ? 'logs.follow.on' : 'logs.follow.off')}
      </span>
      <Button
        size="sm"
        variant="tertiary"
        onPress={follow.isFollowing ? onPause : onFollow}
      >
        {t(follow.isFollowing ? 'logs.follow.pause' : 'logs.follow.resume')}
      </Button>
      <span className="me-auto">
        {t('logs.count', { matching, capacity: LOG_BUFFER_CAPACITY })}
      </span>
      <DebugDetailsSwitch />
    </div>
  )
}
