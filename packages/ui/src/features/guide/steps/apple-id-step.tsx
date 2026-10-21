import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SignInDialog } from '@ui/features/accounts/sign-in/sign-in-dialog.tsx'
import { CheckRow } from '@ui/features/guide/components/check-row.tsx'
import { GuideNav } from '@ui/features/guide/components/guide-nav.tsx'
import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { TeamChoice } from '@ui/features/guide/components/team-choice.tsx'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import { useGuide } from '@ui/hooks/use-guide.ts'
import { useActiveAccount } from '@ui/hooks/use-selection.ts'

/**
 * Your Apple ID: why IPAForge needs one and where the password stays, then sign-in (with the code), then the team
 * when the Apple ID has more than one. The team picked is used by the guide's install.
 */
export const AppleIdStep = () => {
  const { t } = useTranslation()
  const nav = useGuideStep()
  const { guide, chooseTeam } = useGuide()
  const account = useActiveAccount()
  const answer = useTeams(account?.id).data
  const teams = answer?.kind === 'teams' ? answer.teams : []
  const [isSigningIn, setSigningIn] = useState(false)
  const onSignIn = () => setSigningIn(true)
  const onClose = () => setSigningIn(false)
  const onSignedIn = () => undefined
  const teamId = guide.teamId ?? teams[0]?.id ?? ''

  return (
    <>
      <StepHeader titleKey="guide.appleid.title" leadKey="guide.appleid.lead" />
      {account ? (
        <>
          <ul
            aria-label={t('guide.appleid.title')}
            className="flex flex-col gap-2"
          >
            <CheckRow state="ok" title={account.appleId}>
              {t('guide.appleid.signedIn')}
            </CheckRow>
          </ul>
          <SignInNeededNotice />
          {teams.length > 1 ? (
            <TeamChoice teams={teams} value={teamId} onChange={chooseTeam} />
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-prose rounded-xl bg-surface-secondary px-3 py-2 text-muted text-sm">
            {t('guide.appleid.freeNote')}
          </p>
          <Button onPress={onSignIn}>{t('guide.appleid.signIn')}</Button>
        </div>
      )}
      <GuideNav
        onBack={nav.onBack}
        onSkip={nav.onSkip}
        onNext={nav.onContinue}
        nextLabel={t(nav.isLast ? 'guide.done' : 'guide.continue')}
        isNextDisabled={!account}
      />
      {isSigningIn ? (
        <SignInDialog onClose={onClose} onSignedIn={onSignedIn} />
      ) : null}
    </>
  )
}
