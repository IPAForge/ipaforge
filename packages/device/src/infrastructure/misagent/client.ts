import { type DeviceProfile, summarizeProfile } from "@device/domain/profiles.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import { type FrameLimits, receivePlist, sendPlist } from "@device/infrastructure/framing/plist-frames.ts";
import { createDict, ErrorCode, LoadstarError, type Logger, type PlistDict, type PlistValue } from "@loadstar/kernel";

const PROFILE_TYPE = "Provisioning";

export interface Misagent {
  /** All provisioning profiles on the device. */
  list(): Promise<DeviceProfile[]>;
  install(profile: Uint8Array): Promise<void>;
  remove(uuid: string): Promise<void>;
  close(): Promise<void>;
}

const statusOf = (response: PlistDict): number => {
  const status = response.Status;
  return typeof status === "number" ? status : typeof status === "bigint" ? Number(status) : -1;
};

export const createMisagent = (link: Link, options: { limits: FrameLimits; logger: Logger }): Misagent => {
  const { limits, logger } = options;

  const request = async (messageType: string, fields: readonly (readonly [string, PlistValue])[] = []) => {
    logger.debug("misagent", { messageType });
    await sendPlist(link, createDict([["MessageType", messageType], ["ProfileType", PROFILE_TYPE], ...fields]));
    return receivePlist(link, limits, "misagent");
  };

  const ensureOk = (response: PlistDict, messageType: string): PlistDict => {
    const status = statusOf(response);
    if (status !== 0) {
      throw new LoadstarError(ErrorCode.ServiceUnavailable, {
        message: `misagent ${messageType} failed with status ${status}`,
        data: { misagentStatus: status, messageType },
      });
    }
    return response;
  };

  const payloads = (response: PlistDict): Uint8Array[] =>
    Array.isArray(response.Payload) ? response.Payload.filter((item) => item instanceof Uint8Array) : [];

  return {
    list: async () => {
      // CopyAll (iOS 9.3+) returns every profile; older systems only answer Copy.
      let response = await request("CopyAll");
      if (statusOf(response) !== 0) response = await request("Copy");
      const profiles: DeviceProfile[] = [];
      for (const raw of payloads(ensureOk(response, "CopyAll"))) {
        const profile = summarizeProfile(raw, limits.plist);
        if (profile) profiles.push(profile);
        else logger.warn("misagent: skipped an unreadable profile", { bytes: raw.byteLength });
      }
      return profiles;
    },

    install: async (profile) => {
      ensureOk(await request("Install", [["Profile", profile]]), "Install");
    },

    remove: async (uuid) => {
      ensureOk(await request("Remove", [["ProfileID", uuid]]), "Remove");
    },

    close: () => link.close(),
  };
};
