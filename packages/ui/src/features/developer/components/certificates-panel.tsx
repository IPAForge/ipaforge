import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PortalCard } from '@ui/features/developer/components/portal-card.tsx'
import { PortalList } from '@ui/features/developer/components/portal-list.tsx'
import { PortalRow } from '@ui/features/developer/components/portal-row.tsx'
import { RevokeDialog } from '@ui/features/developer/components/revoke-dialog.tsx'
import { certificateMakerKeys } from '@ui/features/developer/constants.ts'
import type {
  PortalContext,
  PortalData,
  PortalRowView,
  RowTag
} from '@ui/features/developer/types.ts'
import { appsSignedBy } from '@ui/features/developer/utils/apps-signed-by.ts'
import { certificateMaker } from '@ui/features/developer/utils/certificate-maker.ts'
import { certificatesSummary } from '@ui/features/developer/utils/certificates-summary.ts'
import { isPast } from '@ui/features/developer/utils/is-past.ts'
import { signsText } from '@ui/features/developer/utils/signs-text.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { TeamCertificate } from '@ui/services/engine/types.ts'

type CertificatesPanelProps = {
  context: PortalContext
  certificates: PortalData['certificates']
}

/**
 * The team's certificates: who made each, when it expires and which apps on the device it signs, with Revoke. Free
 * teams hold two at most.
 */
export const CertificatesPanel = ({
  context,
  certificates
}: CertificatesPanelProps) => {
  const { t } = useTranslation()
  const { date, list } = useFormat()
  const [revoking, setRevoking] = useState<TeamCertificate>()
  const data = certificates.data
  const items = data?.certificates ?? []
  const storedSerial = data?.storedSerial
  const deviceName = context.device?.name
  const onClose = () => setRevoking(undefined)
  const viewOf = (certificate: TeamCertificate): PortalRowView => {
    const maker = certificateMaker(certificate, storedSerial)
    const signed = appsSignedBy(certificate.serialNumber, context.apps)
    const tags: RowTag[] = [
      ...(maker === 'thisComputer'
        ? [
            {
              labelKey: 'portal.certificates.thisComputer',
              tone: 'accent'
            } as const
          ]
        : []),
      ...(isPast(certificate.expiresAt)
        ? [{ labelKey: 'portal.expired', tone: 'bad' } as const]
        : [])
    ]
    const signsLine =
      deviceName === undefined
        ? undefined
        : signsText(t, list, signed, deviceName)

    return {
      id: certificate.serialNumber,
      title: t(certificateMakerKeys[maker], {
        machine: certificate.machineName
      }),
      tags,
      code: certificate.serialNumber,
      details: [
        ...(certificate.expiresAt
          ? [
              t('portal.expires', {
                date: date(new Date(certificate.expiresAt))
              })
            ]
          : []),
        ...(signsLine ? [signsLine] : [])
      ]
    }
  }

  return (
    <PortalCard
      title={t('portal.tabs.certificates')}
      hint={t('portal.certificates.hint')}
      summary={data ? certificatesSummary(t, data) : undefined}
    >
      <PortalList
        label={t('portal.tabs.certificates')}
        isPending={certificates.isPending}
        error={certificates.error}
        isEmpty={items.length === 0}
        emptyKey="portal.certificates.empty"
      >
        {items.map((certificate) => {
          const view = viewOf(certificate)
          const onRevoke = () => setRevoking(certificate)

          return (
            <PortalRow
              key={view.id}
              view={view}
              actions={
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={onRevoke}
                  aria-label={t('portal.certificates.revokeOne', {
                    name: view.title
                  })}
                >
                  {t('portal.certificates.revoke')}
                </Button>
              }
            />
          )
        })}
      </PortalList>
      {revoking ? (
        <RevokeDialog
          context={context}
          certificate={revoking}
          maker={certificateMaker(revoking, storedSerial)}
          onClose={onClose}
        />
      ) : null}
    </PortalCard>
  )
}
