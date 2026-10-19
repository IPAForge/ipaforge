import { Button } from '@heroui/react'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QrCode } from '@ui/components/qr-code.tsx'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type SideStoreLinkPanelProps = {
  link: string
  /** What SideStore will ask on the iPhone: add a source, or install an app. */
  askKey: TranslationKey
  body: string
  device: string
}

/**
 * A SideStore link to scan: its QR code beside the three steps on the iPhone, what it does, and the link itself
 * with Copy (on the iPhone, the link opens SideStore too).
 */
export const SideStoreLinkPanel = ({
  link,
  askKey,
  body,
  device
}: SideStoreLinkPanelProps) => {
  const { t } = useTranslation()
  const { clipboard } = useUiServices()
  const [isCopied, setCopied] = useState(false)
  const onCopy = () => clipboard.writeText(link).then(() => setCopied(true))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <QrCode value={link} label={t('sidestore.qrLabel')} />
        <ol className="flex min-w-[min(100%,12rem)] flex-1 list-decimal flex-col gap-1.5 ps-5 text-sm">
          <li>{t('sidestore.steps.camera', { device })}</li>
          <li>{t('sidestore.steps.banner')}</li>
          <li>{t(askKey)}</li>
        </ol>
      </div>
      <p className="text-sm">{body}</p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
        <code className="min-w-0 flex-1 basis-48 break-all text-muted text-xs">
          {link}
        </code>
        <Button size="sm" variant="tertiary" onPress={onCopy}>
          <Copy aria-hidden="true" className="size-4" />
          {t(isCopied ? 'sidestore.copied' : 'sidestore.copy')}
        </Button>
      </div>
      <p className="text-muted text-xs">{t('sidestore.onPhone')}</p>
    </div>
  )
}
