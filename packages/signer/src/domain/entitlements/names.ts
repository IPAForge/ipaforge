// Entitlement keys and identifier conventions used when re-provisioning an app (signer-spec §8.2).

export const APPLICATION_IDENTIFIER = 'application-identifier'
export const TEAM_IDENTIFIER = 'com.apple.developer.team-identifier'
export const KEYCHAIN_ACCESS_GROUPS = 'keychain-access-groups'
export const APPLICATION_GROUPS = 'com.apple.security.application-groups'

/** Xcode build variable for `<TEAMID>.`, sometimes left unexpanded in shipped entitlements. */
export const APP_IDENTIFIER_PREFIX_VARIABLE = '$(AppIdentifierPrefix)'
/** App group identifiers are `group.<reverse-DNS>`. */
export const APP_GROUP_PREFIX = 'group.'
/** A trailing `*` in a profile entitlement covers every identifier with that prefix. */
export const WILDCARD = '*'
