import { Alert } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { ServerTests } from '@ui/features/settings/anisette/types.ts'
import type { AnisetteChoice } from '@ui/services/engine/types.ts'

type ChoiceNoticeProps = {
  choice: AnisetteChoice
  tests: ServerTests
}

/**
 * When the user picks servers: none picked yet (IPAForge still picks by itself), or the picked one didn't answer
 * its test (signing in fails until it's back, another is picked, or Automatic is on again).
 */
export const ChoiceNotice = ({ choice, tests }: ChoiceNoticeProps) => {
  const { t } = useTranslation()
  if (choice.mode !== 'chosen') return null
  const { server } = choice

  if (!server)
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            {t('settings.anisette.noneChosen')}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    )
  if (tests.states[server.address]?.phase !== 'bad') return null

  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>
          {t('settings.anisette.chosenDown', { name: server.name })}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  )
}
