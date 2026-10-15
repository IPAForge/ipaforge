// Developer-API response dicts → domain objects, validated with zod. Unknown extra fields are ignored; a single
// malformed entry is skipped (and logged by the caller) rather than failing the whole list.

import type {
  AppGroup,
  AppId,
  AppIdQuota,
  DevelopmentCertificate,
  ProvisioningProfile,
  RegisteredDevice,
  Team,
} from "@apple/domain/developer.ts";
import { ErrorCode, isPlistDict, LoadstarError, type PlistDict, type PlistValue } from "@loadstar/kernel";
import { z } from "zod";

const text = z.string();
const optionalText = z.string().optional();
const integer = z.union([z.number(), z.bigint().transform(Number)]);
const date = z.instanceof(Date);
const bytes = z.instanceof(Uint8Array);
const dict = z.custom<PlistDict>((value) => isPlistDict(value as PlistValue));

const teamSchema = z.looseObject({
  teamId: text,
  name: optionalText,
  type: optionalText,
  status: optionalText,
  memberships: z.array(z.looseObject({ name: optionalText, platform: optionalText })).optional(),
});

const deviceSchema = z.looseObject({
  deviceNumber: text,
  deviceId: optionalText,
  name: optionalText,
  status: optionalText,
});

const certificateSchema = z.looseObject({
  serialNumber: text,
  certificateId: optionalText,
  name: optionalText,
  machineName: optionalText,
  machineId: optionalText,
  certContent: bytes.optional(),
  certificatePlatform: optionalText,
  status: optionalText,
  expirationDate: date.optional(),
  certificateType: z.looseObject({ platform: optionalText }).optional(),
});

const appIdSchema = z.looseObject({
  appIdId: text,
  identifier: text,
  name: text,
  features: dict.optional(),
  expirationDate: date.optional(),
});

const appGroupSchema = z.looseObject({ applicationGroup: text, identifier: text, name: optionalText });

const profileSchema = z.looseObject({
  provisioningProfileId: text,
  UUID: text,
  name: text,
  encodedProfile: bytes,
  dateExpire: date,
  appIdId: text,
});

/** Parses each entry of `list`; malformed entries are dropped and reported through `onSkip`. */
const parseList = <S extends z.ZodType, T>(
  value: PlistValue | undefined,
  schema: S,
  map: (entry: z.infer<S>) => T,
  onSkip: (entry: unknown) => void,
): T[] => {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const entry of value) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) out.push(map(parsed.data));
    else onSkip(entry);
  }
  return out;
};

const required = <T>(value: T | undefined, what: string): T => {
  if (value === undefined)
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: `response has no ${what}` });
  return value;
};

const FREE_MEMBERSHIP = /free/i;

export const toTeams = (response: PlistDict, onSkip: (entry: unknown) => void): Team[] =>
  parseList(
    response.teams,
    teamSchema,
    (team) => ({
      id: team.teamId,
      name: team.name ?? team.teamId,
      ...(team.type ? { type: team.type } : {}),
      ...(team.status ? { status: team.status } : {}),
      isFree: (team.memberships ?? []).some((membership) => FREE_MEMBERSHIP.test(membership.name ?? "")),
    }),
    onSkip,
  );

export const toDevices = (response: PlistDict, onSkip: (entry: unknown) => void): RegisteredDevice[] =>
  parseList(
    response.devices,
    deviceSchema,
    (device) => ({
      udid: device.deviceNumber,
      ...(device.deviceId ? { id: device.deviceId } : {}),
      ...(device.name ? { name: device.name } : {}),
      ...(device.status ? { status: device.status } : {}),
    }),
    onSkip,
  );

export const toCertificate = (entry: z.infer<typeof certificateSchema>): DevelopmentCertificate => {
  const platform = entry.certificatePlatform ?? entry.certificateType?.platform;
  return {
    serialNumber: entry.serialNumber,
    ...(entry.certificateId ? { id: entry.certificateId } : {}),
    ...(entry.name ? { name: entry.name } : {}),
    ...(entry.machineName ? { machineName: entry.machineName } : {}),
    ...(entry.machineId ? { machineId: entry.machineId } : {}),
    ...(entry.certContent ? { content: entry.certContent } : {}),
    ...(platform ? { platform } : {}),
    ...(entry.status ? { status: entry.status } : {}),
    ...(entry.expirationDate ? { expiresAt: entry.expirationDate } : {}),
  };
};

export const toCertificates = (response: PlistDict, onSkip: (entry: unknown) => void): DevelopmentCertificate[] =>
  parseList(response.certificates, certificateSchema, toCertificate, onSkip);

const toAppId = (entry: z.infer<typeof appIdSchema>): AppId => ({
  id: entry.appIdId,
  identifier: entry.identifier,
  name: entry.name,
  features: entry.features ?? ({} as PlistDict),
  ...(entry.expirationDate ? { expiresAt: entry.expirationDate } : {}),
});

export const toAppIds = (
  response: PlistDict,
  onSkip: (entry: unknown) => void,
): { appIds: AppId[]; quota: AppIdQuota } => {
  const max = integer.safeParse(response.maxQuantity);
  const available = integer.safeParse(response.availableQuantity);
  return {
    appIds: parseList(response.appIds, appIdSchema, toAppId, onSkip),
    quota: {
      ...(max.success ? { max: max.data } : {}),
      // Apple sometimes reports a negative or missing quantity; never let that turn into "plenty".
      available: available.success ? Math.max(0, available.data) : 0,
    },
  };
};

export const toCreatedAppId = (response: PlistDict): AppId =>
  toAppId(appIdSchema.parse(required(response.appId, "appId")));

export const toAppGroups = (response: PlistDict, onSkip: (entry: unknown) => void): AppGroup[] =>
  parseList(
    response.applicationGroupList,
    appGroupSchema,
    (group) => ({
      id: group.applicationGroup,
      identifier: group.identifier,
      ...(group.name ? { name: group.name } : {}),
    }),
    onSkip,
  );

export const toAppGroup = (response: PlistDict): AppGroup => {
  const group = appGroupSchema.parse(required(response.applicationGroup, "applicationGroup"));
  return { id: group.applicationGroup, identifier: group.identifier, ...(group.name ? { name: group.name } : {}) };
};

export const toProfile = (response: PlistDict): ProvisioningProfile => {
  const profile = profileSchema.parse(required(response.provisioningProfile, "provisioningProfile"));
  return {
    id: profile.provisioningProfileId,
    uuid: profile.UUID,
    name: profile.name,
    data: profile.encodedProfile,
    expiresAt: profile.dateExpire,
    appIdId: profile.appIdId,
  };
};

export const toSubmittedCertificate = (response: PlistDict): { serialNumber?: string; id?: string } => {
  const request = response.certRequest;
  if (!isPlistDict(request)) throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "no certRequest" });
  const serial = request.serialNum ?? request.serialNumber;
  const id = request.certificateId ?? request.certRequestId;
  return {
    ...(typeof serial === "string" ? { serialNumber: serial } : {}),
    ...(typeof id === "string" ? { id } : {}),
  };
};
