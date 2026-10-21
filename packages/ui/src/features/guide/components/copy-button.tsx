import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type CopyButtonProps = {
  text: string
}

/** Copies a command to paste in a terminal; says Copied once it's on the clipboard. */
export const CopyButton = ({ text }: CopyButtonProps) => {
  const { t } = useTranslation()
  const { clipboard } = useUiServices()
  const [isCopied, setCopied] = useState(false)
  const onCopy = () => {
    void clipboard.writeText(text).then(() => setCopied(true))
  }

  return (
    <Button size="sm" variant="secondary" onPress={onCopy}>
      {t(isCopied ? 'guide.copied' : 'guide.copy')}
    </Button>
  )
}
