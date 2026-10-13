import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { createDict, isPlistDict, type PlistDict, type PlistValue } from "@signer/domain/plist/index.ts";

export interface IdentityRewrite {
  readonly oldMainId: string;
  readonly newMainId: string;
  /** Old app group → new app group (e.g. `group.com.x` → `group.com.x.TEAMID`). */
  readonly appGroups: ReadonlyMap<string, string>;
}

/** New bundle ID for an extension/watch app: keep the suffix after the parent's ID. */
export const rewriteNestedId = (oldId: string, rewrite: IdentityRewrite): string => {
  if (oldId === rewrite.oldMainId) return rewrite.newMainId;
  if (!oldId.startsWith(`${rewrite.oldMainId}.`)) {
    throw new LoadstarError(ErrorCode.ExtensionPrefix, {
      message: `bundle ID "${oldId}" is not prefixed by its app's ID "${rewrite.oldMainId}"`,
      data: { bundleId: oldId, appId: rewrite.oldMainId },
    });
  }
  return rewrite.newMainId + oldId.slice(rewrite.oldMainId.length);
};

const replacePrefix = (value: string, rewrite: IdentityRewrite): string =>
  value === rewrite.oldMainId || value.startsWith(`${rewrite.oldMainId}.`)
    ? rewrite.newMainId + value.slice(rewrite.oldMainId.length)
    : value;

const mapStrings = (value: PlistValue | undefined, map: (text: string) => string): PlistValue | undefined => {
  if (typeof value === "string") return map(value);
  if (Array.isArray(value)) return [...new Set(value.map((item) => (typeof item === "string" ? map(item) : item)))];
  return value;
};

const setIn = (
  dict: PlistDict,
  path: readonly string[],
  update: (value: PlistValue | undefined) => PlistValue | undefined,
): PlistDict => {
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
  const group = (text: string): string => rewrite.appGroups.get(text) ?? text;
  let out = setIn(info, ["CFBundleIdentifier"], () => newBundleId);
  out = setIn(out, ["WKCompanionAppBundleIdentifier"], (v) => mapStrings(v, (t) => replacePrefix(t, rewrite)));
  out = setIn(out, ["NSExtension", "NSExtensionAttributes", "WKAppBundleIdentifier"], (v) =>
    mapStrings(v, (t) => replacePrefix(t, rewrite)),
  );
  out = setIn(out, ["BGTaskSchedulerPermittedIdentifiers"], (v) => mapStrings(v, (t) => replacePrefix(t, rewrite)));
  out = setIn(out, ["NSExtension", "NSExtensionFileProviderDocumentGroup"], (v) => mapStrings(v, group));
  out = setIn(out, ["ALTAppGroups"], (v) => mapStrings(v, group));
  return out;
};
