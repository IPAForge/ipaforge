// Makes room under the free-team app limit before an install: counts the apps holding a slot, asks which one to
// remove when there is no room, then uninstalls it and removes its profiles.
import { ask } from "@installer/application/ask.ts";
import {
  type FreeProfileApp,
  type FreeProfileRules,
  freeProfileBundleIds,
  needsFreeSlot,
  occupiedFreeSlots,
  type ProfileFacts,
  profilesOf,
} from "@installer/domain/free-apps.ts";
import { PromptKind } from "@installer/domain/prompts.ts";
import type { StepContext } from "@installer/pipeline/step.ts";
import type { DeviceHandle, DeviceProfile } from "@loadstar/device";
import { compact, ErrorCode, LoadstarError } from "@loadstar/kernel";
import { parseProvisioningProfile } from "@loadstar/signer";

export interface FreeSlotRequest {
  readonly rules: FreeProfileRules;
  readonly limit: number;
  /** New main bundle ID of the app about to be installed. */
  readonly installing: string;
}

export interface FreeSlots {
  readonly profiles: readonly ProfileFacts[];
  readonly occupied: readonly FreeProfileApp[];
}

/** misagent's summary has no creation date; the profile itself does. Unreadable profiles just lack it. */
const creationDate = (raw: Uint8Array): Date | undefined => {
  try {
    return parseProvisioningProfile(raw).creationDate;
  } catch {
    return undefined;
  }
};

const profileFacts = (profile: DeviceProfile): ProfileFacts =>
  compact({
    uuid: profile.uuid,
    teamId: profile.teamId,
    applicationIdentifier: profile.applicationIdentifier,
    createdAt: creationDate(profile.raw),
    expiresAt: profile.expirationDate,
  });

/** The device's profiles and the installed apps holding a free-profile slot, `installing` left out. */
export const freeSlotsOnDevice = async (
  handle: DeviceHandle,
  rules: FreeProfileRules,
  installing: string,
): Promise<FreeSlots> => {
  const profiles = (await handle.listProfiles()).map(profileFacts);
  const free = freeProfileBundleIds(profiles, rules);
  if (free.size === 0) return { profiles, occupied: [] };
  const installed = await handle.lookupApps([...free]);
  return { profiles, occupied: occupiedFreeSlots(free, installed, installing) };
};

/** Uninstalls `bundleId` and removes its profiles and its extensions' profiles. */
export const removeFreeApp = async (
  handle: DeviceHandle,
  profiles: readonly ProfileFacts[],
  bundleId: string,
): Promise<void> => {
  await handle.uninstall(bundleId);
  for (const uuid of profilesOf(profiles, bundleId)) await handle.removeProfile(uuid);
};

/** Asks which of `apps` to remove; anything not offered is refused as the limit error. */
export const chooseAppToRemove = async (
  context: StepContext,
  apps: readonly FreeProfileApp[],
  request: Pick<FreeSlotRequest, "limit" | "installing">,
): Promise<string> => {
  const chosen = await ask(context, PromptKind.ChooseAppToRemove, {
    limit: request.limit,
    installing: request.installing,
    apps,
  });
  if (apps.some((app) => app.bundleId === chosen)) return chosen;
  throw new LoadstarError(ErrorCode.FreeAppLimit, {
    message: "no app was chosen to make room",
    data: { limit: request.limit, apps: apps.map((app) => app.bundleId) },
  });
};

/** Frees slots until one more free-profile app fits, asking the user each time which app goes. */
export const ensureFreeSlot = async (
  handle: DeviceHandle,
  context: StepContext,
  request: FreeSlotRequest,
): Promise<void> => {
  for (;;) {
    const { profiles, occupied } = await freeSlotsOnDevice(handle, request.rules, request.installing);
    if (!needsFreeSlot(occupied, request.limit)) return;
    await removeFreeApp(handle, profiles, await chooseAppToRemove(context, occupied, request));
  }
};
