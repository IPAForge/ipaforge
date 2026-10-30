import { Disclosure } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { notFoundHelpKeys } from '@ui/features/devices/pair/constants.ts'

/** "It doesn't show up": what keeps a device from being found, folded away until asked for. */
export const NotFoundHelp = () => {
  const { t } = useTranslation()

  return (
    <Disclosure className="text-sm">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex items-center gap-1.5 text-sm">
          {t('pairByCode.help.title')}
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <ul className="list-disc ps-5 text-muted">
            {notFoundHelpKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  )
}
