import { useTranslation } from 'react-i18next'

import { modelName } from '@ui/features/devices/utils/model-name.ts'
import type { RunTarget } from '@ui/features/install/run/types.ts'
import { diagnosticsText } from '@ui/features/install/run/utils/diagnostics-text.ts'
import { installLine } from '@ui/features/install/run/utils/install-line.ts'
import { stepLabel } from '@ui/features/install/run/utils/step-label.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { ActiveRun, RunFailure } from '@ui/state/active-run/types.ts'

const UNKNOWN = 'unknown'

/**
 * The diagnostics for a failed run, in English whatever the UI language: the step, app, channel and device model
 * by name, each followed by the identifier maintainers search for.
 */
export const useDiagnostics = (
  run: ActiveRun,
  failure: RunFailure,
  target: RunTarget
): string => {
  const { i18n } = useTranslation()
  const en = i18n.getFixedT('en')
  const { appVersion } = useUiServices()
  const labelKey = stepLabel(run, failure.stepId)
  const info = target.check?.info
  const step = labelKey
    ? `${en(labelKey as TranslationKey)} (${failure.stepId})`
    : failure.stepId || UNKNOWN
  const device = info
    ? `${modelName(info.productType)} (${info.productType}), iOS ${info.productVersion}`
    : UNKNOWN

  return diagnosticsText({
    appVersion,
    code: failure.error.code,
    step,
    install: installLine(run, en),
    device
  })
}
