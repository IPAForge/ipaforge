// lockdownd's device values (a `GetValue` without a key), validated at the boundary.
import type { DeviceInfo } from "@device/domain/device.ts";
import { compact, ErrorCode, isPlistDict, LoadstarError, type PlistValue } from "@loadstar/kernel";
import { z } from "zod";

const deviceInfoSchema = z.looseObject({
  UniqueDeviceID: z.string(),
  DeviceName: z.string(),
  ProductType: z.string(),
  ProductVersion: z.string(),
  BuildVersion: z.string(),
  DeviceClass: z.string(),
  CPUArchitecture: z.string().optional(),
  ActivationState: z.string().optional(),
  PasswordProtected: z.boolean().optional(),
});

export const toDeviceInfo = (values: PlistValue | undefined): DeviceInfo => {
  const parsed = deviceInfoSchema.safeParse(isPlistDict(values) ? values : undefined);
  if (!parsed.success) {
    throw new LoadstarError(ErrorCode.DeviceProtocolError, {
      message: "unexpected device values",
      cause: parsed.error,
    });
  }
  const v = parsed.data;
  return compact({
    udid: v.UniqueDeviceID,
    name: v.DeviceName,
    productType: v.ProductType,
    productVersion: v.ProductVersion,
    buildVersion: v.BuildVersion,
    deviceClass: v.DeviceClass,
    // Empty strings count as missing.
    cpuArchitecture: v.CPUArchitecture || undefined,
    activationState: v.ActivationState || undefined,
    locked: v.PasswordProtected,
  });
};
