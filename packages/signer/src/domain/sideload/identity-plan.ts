// The identities a sideloaded app takes under a team (signer-spec §8.1–8.2), planned from an inspection.
import { compact } from '@loadstar/kernel'
import { rewriteNestedId } from '@signer/domain/bundle/info-plist.ts'
import type { IdentityRewrite } from '@signer/domain/bundle/types.ts'
import { APP_GROUP_PREFIX } from '@signer/domain/entitlements/names.ts'
import type {
  BundleIdentity,
  IpaInspection,
  SideloadIdentityPlan
} from '@signer/domain/sideload/types.ts'

const declaredAppGroups = (inspection: IpaInspection): string[] => [
  ...new Set([...inspection.appGroups, ...inspection.altAppGroups])
]

/** New bundle IDs, App ID names and the app group for installing `inspection` under `teamId`. */
export const planSideloadIdentity = (
  inspection: IpaInspection,
  teamId: string
): SideloadIdentityPlan => {
  const newMainBundleId = `${inspection.app.identifier}.${teamId}`
  const rewrite: IdentityRewrite = {
    oldMainId: inspection.app.identifier,
    newMainId: newMainBundleId,
    appGroups: new Map()
  }
  const bundles: BundleIdentity[] = [
    { identifier: newMainBundleId, name: inspection.app.name },
    ...inspection.nested.map((bundle) => ({
      identifier: rewriteNestedId(bundle.identifier, rewrite),
      name: bundle.name
    }))
  ]

  const oldGroups = declaredAppGroups(inspection)
  const appGroup =
    oldGroups.length > 0 ? `${APP_GROUP_PREFIX}${newMainBundleId}` : undefined
  const appGroups = new Map(
    appGroup ? oldGroups.map((group) => [group, appGroup]) : []
  )

  return compact({ newMainBundleId, bundles, appGroup, appGroups })
}
