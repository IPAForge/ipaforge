import { useTranslation } from 'react-i18next'

import { stepReportTexts } from '@ui/features/install/run/utils/step-report-texts.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { StepView } from '@ui/state/active-run/types.ts'

/** What a step did, in words ("SideStore 0.7.0 · Stable"); undefined until the Engine reports it. */
export const useStepReport = (
  step: StepView,
  appName: string
): string | undefined => {
  const { t } = useTranslation()
  const { fileSize, list } = useFormat()
  const { report } = step
  if (!report) return undefined
  const text = stepReportTexts[report.kind] as (
    report: NonNullable<StepView['report']>,
    words: Parameters<(typeof stepReportTexts)['device']>[1]
  ) => string

  return text(report, { t, fileSize, list, appName })
}
