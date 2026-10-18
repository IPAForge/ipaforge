import { RunView } from '@ui/features/install/run/run-view.tsx'
import { PreloadHome } from '@ui/features/preload/home/preload-home.tsx'
import { useRun } from '@ui/hooks/use-run.ts'

/** Preload: the list of apps to install and Install, or the apps run in progress (or just ended). */
export const PreloadPage = () => {
  const { run } = useRun()

  return run?.kind === 'apps' ? <RunView run={run} /> : <PreloadHome />
}
