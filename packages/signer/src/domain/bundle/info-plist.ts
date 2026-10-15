import { createDict, ErrorCode, isPlistDict, LoadstarError, type PlistDict, type PlistValue } from "@loadstar/kernel";

export interface IdentityRewrite {
  readonly oldMainId: string;
  readonly newMainId: string;
  /** Old app group → new app group (e.g. `group.com.x` → `group.com.x.TEAMID`). */
  readonly appGroups: ReadonlyMap<string, string>;
}

/** The main app's ID itself, or an ID nested under it (`<main>.suffix`). */
const isUnderMainId = (value: string, rewrite: IdentityRewrite): boolean =>
  value === rewrite.oldMainId || value.startsWith(`${rewrite.oldMainId}.`);

const replacePrefix = (value: string, rewrite: IdentityRewrite): string =>
  isUnderMainId(value, rewrite) ? rewrite.newMainId + value.slice(rewrite.oldMainId.length) : value;

/** New bundle ID for an extension/watch app: keep the suffix after the parent's ID. */
export const rewriteNestedId = (oldId: string, rewrite: IdentityRewrite): string => {
  if (!isUnderMainId(oldId, rewrite)) {
    throw new LoadstarError(ErrorCode.ExtensionPrefix, {
      message: `bundle ID "${oldId}" is not prefixed by its app's ID "${rewrite.oldMainId}"`,
      data: { bundleId: oldId, appId: rewrite.oldMainId },
    });
  }
  return replacePrefix(oldId, rewrite);
};

const mapStrings = (value: PlistValue | undefined, map: (text: string) => string): PlistValue | undefined => {
  if (typeof value === "string") return map(value);
  if (Array.isArray(value)) return [...new Set(value.map((item) => (typeof item === "string" ? map(item) : item)))];
  return value;
};

type ValueUpdate = (value: PlistValue | undefined) => PlistValue | undefined;

const setIn = (dict: PlistDict, path: readonly string[], update: ValueUpdate): PlistDict => {
  const [head, ...rest] = path;
  if (head === undefined || !(head in dict)) return dict;
  const current = dict[head];
  const next = rest.length === 0 ? update(current) : isPlistDict(current) ? setIn(current, rest, update) : current;
  if (next === current || next === undefined) return dict;
  return createDict(Object.entries(dict).map(([key, value]) => [key, key === head ? next : value]));
};

/**
 * Rewrites the identity-bearing keys of an Info.plist for sideloading (signer-spec §8.1):
 * CFBundleIdentifier, Watch companion IDs, background task IDs, app groups.
 */
export const rewriteInfoPlist = (info: PlistDict, newBundleId: string, rewrite: IdentityRewrite): PlistDict => {
  const bundleIds: ValueUpdate = (value) => mapStrings(value, (text) => replacePrefix(text, rewrite));
  const appGroups: ValueUpdate = (value) => mapStrings(value, (text) => rewrite.appGroups.get(text) ?? text);
  const updates: readonly [readonly string[], ValueUpdate][] = [
    [["CFBundleIdentifier"], () => newBundleId],
    [["WKCompanionAppBundleIdentifier"], bundleIds],
    [["NSExtension", "NSExtensionAttributes", "WKAppBundleIdentifier"], bundleIds],
    [["BGTaskSchedulerPermittedIdentifiers"], bundleIds],
    [["NSExtension", "NSExtensionFileProviderDocumentGroup"], appGroups],
    [["ALTAppGroups"], appGroups],
  ];
  return updates.reduce((out, [path, update]) => setIn(out, path, update), info);
};
