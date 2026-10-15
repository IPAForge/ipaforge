// Concrete keychain access groups for a re-provisioned executable (signer-spec §8.2).
import { type PlistDict, stringAt } from "@loadstar/kernel";
import { stringsOf } from "@signer/domain/dict.ts";
import {
  APP_IDENTIFIER_PREFIX_VARIABLE,
  APPLICATION_IDENTIFIER,
  KEYCHAIN_ACCESS_GROUPS,
  TEAM_IDENTIFIER,
} from "@signer/domain/entitlements/names.ts";
import { isWildcard, matchesPattern } from "@signer/domain/entitlements/pattern.ts";

export interface KeychainGroups {
  /** The groups to sign with. */
  readonly groups: readonly string[];
  /** Groups the executable declared that the profile does not allow, as declared. */
  readonly dropped: readonly string[];
}

/** The team the executable was signed for: its team identifier, else its application-identifier prefix. */
const originalTeamId = (entitlements: PlistDict): string | undefined =>
  stringAt(entitlements, TEAM_IDENTIFIER) ?? stringAt(entitlements, APPLICATION_IDENTIFIER)?.split(".")[0];

/** Prefixes that stand for the old team: the unexpanded Xcode variable and `<OLDTEAM>.`. */
const oldTeamPrefixes = (entitlements: PlistDict): string[] => {
  const team = originalTeamId(entitlements);
  return team ? [APP_IDENTIFIER_PREFIX_VARIABLE, `${team}.`] : [APP_IDENTIFIER_PREFIX_VARIABLE];
};

const rebase = (group: string, prefixes: readonly string[], teamId: string): string => {
  const prefix = prefixes.find((candidate) => group.startsWith(candidate));
  return prefix === undefined ? group : `${teamId}.${group.slice(prefix.length)}`;
};

/**
 * When the profile grants a wildcard keychain group (`<TEAMID>.*`) and the executable declared concrete
 * groups, those groups moved to the new team and filtered by the profile's patterns; the profile's own
 * value when none survive. `undefined` when there is nothing to concretise.
 */
export const concreteKeychainGroups = (
  granted: PlistDict,
  original: PlistDict | undefined,
  teamId: string,
): KeychainGroups | undefined => {
  const patterns = stringsOf(granted[KEYCHAIN_ACCESS_GROUPS]);
  const requested = original ? stringsOf(original[KEYCHAIN_ACCESS_GROUPS]) : [];
  if (!original || requested.length === 0 || !patterns.some(isWildcard)) return undefined;

  const prefixes = oldTeamPrefixes(original);
  const allowed = new Set<string>();
  const dropped: string[] = [];
  for (const group of requested) {
    const concrete = rebase(group, prefixes, teamId);
    if (patterns.some((pattern) => matchesPattern(pattern, concrete))) allowed.add(concrete);
    else dropped.push(group);
  }
  return { groups: allowed.size > 0 ? [...allowed] : patterns, dropped };
};
