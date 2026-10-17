import { PlaceholderPage } from '@ui/components/placeholder-page.tsx'
import { BlockedNotice } from '@ui/features/install/blocked-notice.tsx'
import { DeviceInUseNotice } from '@ui/features/install/device-in-use-notice.tsx'
import { SignInNeededNotice } from '@ui/features/install/sign-in-needed-notice.tsx'

/** The home page. The install flow itself lands with the install run; until then, what to fix before installing. */
export const InstallPage = () => (
  <PlaceholderPage
    titleKey="install.title"
    descriptionKey="install.description"
  >
    <DeviceInUseNotice />
    <BlockedNotice />
    <SignInNeededNotice />
  </PlaceholderPage>
)
