import type { PortalContext } from '@ui/features/developer/types.ts'
import { useAppGroups } from '@ui/hooks/queries/use-app-groups.ts'
import { useAppIdQuota } from '@ui/hooks/queries/use-app-id-quota.ts'
import { useCertificates } from '@ui/hooks/queries/use-certificates.ts'
import { useDeviceProfiles } from '@ui/hooks/queries/use-device-profiles.ts'
import { useRegisteredDevices } from '@ui/hooks/queries/use-registered-devices.ts'

/**
 * Everything the Developer Portal shows, read when the page opens (each tab's count needs it) and again on Refresh:
 * the team's certificates, App IDs, app groups and registered devices, and the profiles on the device in use.
 */
export const usePortalData = (context: PortalContext) => {
  const query = context.canAsk ? context.query : undefined

  return {
    certificates: useCertificates(query),
    appIds: useAppIdQuota(query),
    groups: useAppGroups(query),
    devices: useRegisteredDevices(query),
    profiles: useDeviceProfiles(context.device?.udid)
  }
}
