import { InstallHome } from '@ui/features/install/home/install-home.tsx'
import { RunView } from '@ui/features/install/run/run-view.tsx'
import { useRun } from '@ui/hooks/use-run.ts'

/** The home page: what to install and whether it can start, or the run in progress (or just ended). */
export const InstallPage = () => {
  const { run } = useRun()

  return run?.kind === 'sidestore' ? <RunView run={run} /> : <InstallHome />
}
