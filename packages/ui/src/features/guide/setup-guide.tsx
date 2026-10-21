import { MAIN_CONTENT_ID } from '@ui/components/shell/constants.ts'
import { GuideStepsNav } from '@ui/features/guide/components/guide-steps-nav.tsx'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { guideStepPages } from '@ui/features/guide/steps/step-pages.ts'

/** The setup guide in place of the sidebar and pages: its steps on the start edge, the step shown beside them. */
export const SetupGuide = () => {
  const { step } = useGuideStep()
  const Page = guideStepPages[step]

  return (
    <div className="flex min-h-0 flex-1">
      <GuideStepsNav />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="min-w-0 flex-1 overflow-y-auto p-6 outline-none"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <Page />
        </div>
      </main>
    </div>
  )
}
