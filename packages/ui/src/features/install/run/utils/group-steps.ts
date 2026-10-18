import type { AppStepGroup } from '@ui/features/install/run/types.ts'
import type { RunApp, StepView } from '@ui/state/active-run/types.ts'

const APP_STEP_ID = /-(\d+)$/

/** The app a step belongs to (`inspect-1` → 1); undefined for the run's shared steps (the device, the Apple ID). */
const appIndex = (stepId: string): number | undefined => {
  const match = APP_STEP_ID.exec(stepId)

  return match ? Number(match[1]) : undefined
}

/**
 * An apps run's steps by app: the shared steps first (the device, sign-in, team, certificate, App IDs, the
 * pairing file), then each app's own (found, checked, provisioned, signed, installed), in the Engine's order.
 */
export const groupSteps = (
  steps: readonly StepView[],
  apps: readonly RunApp[]
): readonly AppStepGroup[] => {
  const shared: StepView[] = []
  const byApp = apps.map(() => [] as StepView[])
  for (const step of steps) {
    const index = appIndex(step.id)
    const group = index === undefined ? undefined : byApp[index]
    if (group) group.push(step)
    else shared.push(step)
  }

  return [
    { key: 'shared', steps: shared },
    ...apps.map((app, index) => ({
      key: `app-${index}`,
      app,
      steps: byApp[index] ?? []
    }))
  ]
}

/** How a group of steps is going, from its steps. */
export const groupState = (
  steps: readonly StepView[]
): 'failed' | 'done' | 'active' | 'pending' => {
  if (steps.some((step) => step.state === 'failed')) return 'failed'
  if (
    steps.length > 0 &&
    steps.every((step) => step.state === 'done' || step.state === 'skipped')
  )
    return 'done'
  if (steps.some((step) => step.state === 'active' || step.state === 'waiting'))
    return 'active'
  return 'pending'
}
