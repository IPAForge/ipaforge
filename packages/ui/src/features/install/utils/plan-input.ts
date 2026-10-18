import type { RemotePlanInstallInput } from '@loadstar/rpc'
import { variantAppId } from '@ui/services/engine/constants.ts'
import type { InstallSideStoreInput } from '@ui/services/engine/types.ts'

/**
 * The plan query's input for an install, the same on the home page and during the run, so the run reads the plan
 * the home page already has (App IDs left and when the next frees, free-app slots).
 */
export const planInput = ({
  udid,
  accountId,
  variant,
  channel
}: InstallSideStoreInput): RemotePlanInstallInput => ({
  udid,
  accountId,
  source: { kind: 'catalog', appId: variantAppId[variant], channel }
})
