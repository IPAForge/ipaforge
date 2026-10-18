import {
  FRAMEWORK_PREFIX,
  LIVECONTAINER_BUNDLE_ID,
  MAIN_APP_PATH,
  SIDESTORE_BUNDLE_ID,
  SIDESTORE_FRAMEWORK_NAME
} from '@installer/sidestore/constants.ts'
import type { CodeBundle } from '@ipaforge/signer'

const isDirectFramework = (bundle: CodeBundle): boolean =>
  bundle.kind === 'framework' &&
  bundle.path.startsWith(FRAMEWORK_PREFIX) &&
  !bundle.path.slice(FRAMEWORK_PREFIX.length).includes('/')

const isSideStoreFramework = (bundle: CodeBundle): boolean =>
  isDirectFramework(bundle) &&
  (bundle.path === `${FRAMEWORK_PREFIX}${SIDESTORE_FRAMEWORK_NAME}` ||
    bundle.identifier.startsWith(SIDESTORE_BUNDLE_ID))

/**
 * The bundle SideStore reads its certificate from, by **original** bundle ID: the app itself for SideStore,
 * the SideStore framework for LiveContainer + SideStore, nothing for any other app.
 */
export const findSideStoreTarget = (
  bundles: readonly CodeBundle[]
): CodeBundle | undefined => {
  const main = bundles.find((bundle) => bundle.path === MAIN_APP_PATH)
  if (main?.identifier === SIDESTORE_BUNDLE_ID) return main
  if (main?.identifier === LIVECONTAINER_BUNDLE_ID)
    return bundles.find(isSideStoreFramework)
  return undefined
}
