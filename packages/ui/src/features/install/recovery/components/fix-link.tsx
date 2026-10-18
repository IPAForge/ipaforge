import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type FixLinkProps = { url: string }

/** An Apple page: Open (in the browser) and Copy. */
export const FixLink = ({ url }: FixLinkProps) => {
  const { t } = useTranslation()
  const { clipboard, links } = useUiServices()
  const [isCopied, setCopied] = useState(false)
  const onOpen = () => links.open(url)
  const onCopy = () => clipboard.writeText(url).then(() => setCopied(true))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded-md bg-surface-secondary px-2 py-1 text-xs">
        {url}
      </code>
      <Button size="sm" variant="secondary" onPress={onOpen}>
        {t('recovery.fix.open')}
      </Button>
      <Button size="sm" variant="tertiary" onPress={onCopy}>
        {t(isCopied ? 'recovery.fix.copied' : 'recovery.fix.copy')}
      </Button>
    </div>
  )
}
