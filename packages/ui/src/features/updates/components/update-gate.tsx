import { type ReactNode, useState } from 'react'

import { ManualUpdateDialog } from '@ui/features/updates/components/manual-update-dialog.tsx'
import { NativeBuildDialog } from '@ui/features/updates/components/native-build-dialog.tsx'
import { UpdateScreen } from '@ui/features/updates/components/update-screen.tsx'
import { blockingPhases } from '@ui/features/updates/constants.ts'
import { useUpdateState } from '@ui/features/updates/hooks/use-update-state.ts'

type UpdateGateProps = { children: ReactNode }

/**
 * Keeps the app behind the update screen while IPAForge checks for, downloads and installs a newer version, so an
 * old version isn't used meanwhile. After a failure the user may go on; a copy that can't update itself only says
 * a new version is out, and the Intel build on an Apple silicon Mac says where the faster one is.
 */
export const UpdateGate = ({ children }: UpdateGateProps) => {
  const state = useUpdateState()
  const [isDismissed, setIsDismissed] = useState(false)
  const onDismiss = () => setIsDismissed(true)

  if (blockingPhases[state.phase] && !(isDismissed && state.phase === 'failed'))
    return <UpdateScreen state={state} onSkip={onDismiss} />

  return (
    <>
      {children}
      {state.phase === 'manual' && !isDismissed ? (
        <ManualUpdateDialog state={state} onLater={onDismiss} />
      ) : null}
      {state.phase === 'idle' && state.nativeBuild && !isDismissed ? (
        <NativeBuildDialog url={state.nativeBuild.url} onLater={onDismiss} />
      ) : null}
    </>
  )
}
