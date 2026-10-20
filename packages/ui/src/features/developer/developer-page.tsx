import { Alert } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { PageTabs } from '@ui/components/page-tabs.tsx'
import type { PageTab } from '@ui/components/types.ts'
import { AppIdsPanel } from '@ui/features/developer/components/app-ids-panel.tsx'
import { CertificatesPanel } from '@ui/features/developer/components/certificates-panel.tsx'
import { DevicesPanel } from '@ui/features/developer/components/devices-panel.tsx'
import { GroupsPanel } from '@ui/features/developer/components/groups-panel.tsx'
import { ProfilesPanel } from '@ui/features/developer/components/profiles-panel.tsx'
import { TeamBar } from '@ui/features/developer/components/team-bar.tsx'
import { portalTabLabelKeys } from '@ui/features/developer/constants.ts'
import { usePortalContext } from '@ui/features/developer/hooks/use-portal-context.ts'
import { usePortalData } from '@ui/features/developer/hooks/use-portal-data.ts'
import type { PortalTab } from '@ui/features/developer/types.ts'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'

/**
 * Developer Portal: what the Apple ID's team holds at Apple (certificates, App IDs, app groups, registered devices)
 * and the provisioning profiles on the device in use, one tab each, with what each is used for and a way to clean
 * up what isn't.
 */
export const DeveloperPage = () => {
  const { t } = useTranslation()
  const context = usePortalContext()
  const data = usePortalData(context)
  const [selected, setSelected] = useState<PortalTab>('certificates')
  const tab = (
    id: PortalTab,
    count: number | undefined,
    panel: PageTab<PortalTab>['panel']
  ): PageTab<PortalTab> => ({
    id,
    labelKey: portalTabLabelKeys[id],
    count,
    panel
  })
  const tabs = [
    tab(
      'certificates',
      data.certificates.data?.certificates.length,
      <CertificatesPanel context={context} certificates={data.certificates} />
    ),
    tab(
      'appIds',
      data.appIds.data?.appIds.length,
      <AppIdsPanel context={context} appIds={data.appIds} />
    ),
    tab(
      'profiles',
      data.profiles.data?.length,
      <ProfilesPanel context={context} profiles={data.profiles} />
    ),
    tab(
      'groups',
      data.groups.data?.groups.length,
      <GroupsPanel groups={data.groups} />
    ),
    tab(
      'devices',
      data.devices.data?.devices.length,
      <DevicesPanel context={context} devices={data.devices} />
    )
  ]

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        titleKey="nav.developer"
        descriptionKey="portal.description"
      />
      <SignInNeededNotice />
      {context.account ? (
        <>
          <TeamBar context={context} />
          {context.canAsk ? (
            <PageTabs
              labelKey="portal.tabsLabel"
              tabs={tabs}
              selected={selected}
              onSelect={setSelected}
            />
          ) : null}
        </>
      ) : (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('portal.noAccount.title')}</Alert.Title>
            <Alert.Description>{t('portal.noAccount.body')}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  )
}
