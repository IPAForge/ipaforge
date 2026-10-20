import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { UpdateState } from '@ipaforge/rpc'
import { UpdateChecking } from '@ui/features/updates/components/update-checking.tsx'
import { UpdateDownloading } from '@ui/features/updates/components/update-downloading.tsx'
import { UpdateFailed } from '@ui/features/updates/components/update-failed.tsx'
import { UpdateInstalling } from '@ui/features/updates/components/update-installing.tsx'

type UpdateScreenProps = {
  state: UpdateState
  onSkip: () => void
}

/** The whole window while IPAForge updates on launch: one card that says how far along it is. */
export const UpdateScreen = ({ state, onSkip }: UpdateScreenProps) => {
  const { t } = useTranslation()

  return (
    <main
      aria-label={t('updates.screen.label')}
      className="flex h-dvh items-center justify-center bg-background p-6 text-foreground"
    >
      <div
        aria-live="polite"
        className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
          <RefreshCw aria-hidden="true" className="size-6" />
        </span>
        {state.phase === 'checking' ? <UpdateChecking /> : null}
        {state.phase === 'downloading' ? (
          <UpdateDownloading state={state} />
        ) : null}
        {state.phase === 'installing' ? (
          <UpdateInstalling state={state} />
        ) : null}
        {state.phase === 'failed' ? (
          <UpdateFailed state={state} onSkip={onSkip} />
        ) : null}
      </div>
    </main>
  )
}
