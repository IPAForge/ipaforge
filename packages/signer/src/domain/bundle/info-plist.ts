import {
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistValue
} from '@loadstar/kernel'
import {
  ALT_APP_GROUPS,
  BG_TASK_SCHEDULER_PERMITTED_IDENTIFIERS,
  CF_BUNDLE_IDENTIFIER,
  NS_EXTENSION,
  NS_EXTENSION_ATTRIBUTES,
  NS_EXTENSION_FILE_PROVIDER_DOCUMENT_GROUP,
  WK_APP_BUNDLE_IDENTIFIER,
  WK_COMPANION_APP_BUNDLE_IDENTIFIER
} from '@signer/domain/bundle/info-keys.ts'
import { assignKey, stringsOf } from '@signer/domain/dict.ts'

export type IdentityRewrite = {
  readonly oldMainId: string
  readonly newMainId: string
  /** Old app group → new app group (e.g. `group.com.x` → `group.com.x.TEAMID`). */
  readonly appGroups: ReadonlyMap<string, string>
}

/** The main app's ID itself, or an ID nested under it (`<main>.suffix`). */
const isUnderId = (value: string, mainId: string): boolean =>
  value === mainId || value.startsWith(`${mainId}.`)

const replacePrefix = (value: string, rewrite: IdentityRewrite): string =>
  isUnderId(value, rewrite.oldMainId)
    ? rewrite.newMainId + value.slice(rewrite.oldMainId.length)
    : value

/** installd rejects an extension or watch app whose ID is not prefixed by its app's ID. */
export const assertNestedId = (nestedId: string, mainId: string): void => {
  if (isUnderId(nestedId, mainId)) return
  throw new LoadstarError(ErrorCode.ExtensionPrefix, {
    message: `bundle ID "${nestedId}" is not prefixed by its app's ID "${mainId}"`,
    data: { bundleId: nestedId, appId: mainId }
  })
}

/** New bundle ID for an extension/watch app: keep the suffix after the parent's ID. */
export const rewriteNestedId = (
  oldId: string,
  rewrite: IdentityRewrite
): string => {
  assertNestedId(oldId, rewrite.oldMainId)
  return replacePrefix(oldId, rewrite)
}

const mapStrings = (
  value: PlistValue | undefined,
  map: (text: string) => string
): PlistValue | undefined => {
  if (typeof value === 'string') return map(value)
  if (Array.isArray(value))
    return [
      ...new Set(
        value.map((item) => (typeof item === 'string' ? map(item) : item))
      )
    ]
  return value
}

type ValueUpdate = (value: PlistValue | undefined) => PlistValue | undefined

const setIn = (
  dict: PlistDict,
  path: readonly string[],
  update: ValueUpdate
): PlistDict => {
  const [head, ...rest] = path
  if (head === undefined || !(head in dict)) return dict
  const current = dict[head]
  let next = current
  if (rest.length === 0) next = update(current)
  else if (isPlistDict(current)) next = setIn(current, rest, update)
  if (next === current || next === undefined) return dict
  return createDict(
    Object.entries(dict).map(([key, value]) => [
      key,
      key === head ? next : value
    ])
  )
}

/**
 * Rewrites the identity-bearing keys of an Info.plist for sideloading (signer-spec §8.1):
 * CFBundleIdentifier, Watch companion IDs, background task IDs, app groups.
 */
export const rewriteInfoPlist = (
  info: PlistDict,
  newBundleId: string,
  rewrite: IdentityRewrite
): PlistDict => {
  const bundleIds: ValueUpdate = (value) =>
    mapStrings(value, (text) => replacePrefix(text, rewrite))
  const appGroups: ValueUpdate = (value) =>
    mapStrings(value, (text) => rewrite.appGroups.get(text) ?? text)
  const updates: readonly [readonly string[], ValueUpdate][] = [
    [[CF_BUNDLE_IDENTIFIER], () => newBundleId],
    [[WK_COMPANION_APP_BUNDLE_IDENTIFIER], bundleIds],
    [
      [NS_EXTENSION, NS_EXTENSION_ATTRIBUTES, WK_APP_BUNDLE_IDENTIFIER],
      bundleIds
    ],
    [[BG_TASK_SCHEDULER_PERMITTED_IDENTIFIERS], bundleIds],
    [[NS_EXTENSION, NS_EXTENSION_FILE_PROVIDER_DOCUMENT_GROUP], appGroups],
    [[ALT_APP_GROUPS], appGroups]
  ]

  return updates.reduce((out, [path, update]) => setIn(out, path, update), info)
}

/** The app groups an Info.plist lists in `ALTAppGroups`. */
export const altAppGroupsOf = (info: PlistDict): string[] =>
  stringsOf(info[ALT_APP_GROUPS])

/** Lists the app's `ALTAppGroups` in an extension's Info.plist too (none listed: unchanged). */
export const withAltAppGroups = (
  info: PlistDict,
  groups: readonly string[]
): PlistDict =>
  groups.length === 0 ? info : assignKey(info, ALT_APP_GROUPS, [...groups])
