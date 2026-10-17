// Developer-API response dicts → domain objects, validated with zod. Unknown extra fields are ignored; a single
// malformed entry is skipped (and logged by the caller) rather than failing the whole list.

import { z } from 'zod'

import type {
  AppGroup,
  AppId,
  AppIdQuota,
  DevelopmentCertificate,
  ProvisioningProfile,
  RegisteredDevice,
  Team
} from '@apple/domain/types.ts'
import { nonEmpty } from '@apple/domain/values.ts'
import {
  compact,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistValue
} from '@loadstar/kernel'

const text = z.string()
const optionalText = z.string().optional()
const integer = z.union([z.number(), z.bigint().transform(Number)])
const date = z.instanceof(Date)
const bytes = z.instanceof(Uint8Array)
const dict = z.custom<PlistDict>((value) => isPlistDict(value as PlistValue))

const teamSchema = z.looseObject({
  teamId: text,
  name: optionalText,
  type: optionalText,
  status: optionalText,
  memberships: z
    .array(z.looseObject({ name: optionalText, platform: optionalText }))
    .optional()
})

const deviceSchema = z.looseObject({
  deviceNumber: text,
  deviceId: optionalText,
  name: optionalText,
  status: optionalText
})

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
  certificateType: z.looseObject({ platform: optionalText }).optional()
})

const appIdSchema = z.looseObject({
  appIdId: text,
  identifier: text,
  name: text,
  features: dict.optional(),
  expirationDate: date.optional()
})

const appGroupSchema = z.looseObject({
  applicationGroup: text,
  identifier: text,
  name: optionalText
})

const profileSchema = z.looseObject({
  provisioningProfileId: text,
  UUID: text,
  name: text,
  encodedProfile: bytes,
  dateExpire: date,
  appIdId: text
})

/** Parses each entry of `list`; malformed entries are dropped and reported through `onSkip`. */
const parseList = <S extends z.ZodType, T>(
  value: PlistValue | undefined,
  schema: S,
  map: (entry: z.infer<S>) => T,
  onSkip: (entry: unknown) => void
): T[] => {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const entry of value) {
    const parsed = schema.safeParse(entry)
    if (parsed.success) out.push(map(parsed.data))
    else onSkip(entry)
  }
  return out
}

const required = <T>(value: T | undefined, what: string): T => {
  if (value === undefined)
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: `response has no ${what}`
    })
  return value
}

const FREE_MEMBERSHIP = /free/i

export const toTeams = (
  response: PlistDict,
  onSkip: (entry: unknown) => void
): Team[] =>
  parseList(
    response.teams,
    teamSchema,
    (team) =>
      compact({
        id: team.teamId,
        name: team.name ?? team.teamId,
        type: nonEmpty(team.type),
        status: nonEmpty(team.status),
        isFree: (team.memberships ?? []).some((membership) =>
          FREE_MEMBERSHIP.test(membership.name ?? '')
        )
      }),
    onSkip
  )

export const toDevices = (
  response: PlistDict,
  onSkip: (entry: unknown) => void
): RegisteredDevice[] =>
  parseList(
    response.devices,
    deviceSchema,
    (device) =>
      compact({
        udid: device.deviceNumber,
        id: nonEmpty(device.deviceId),
        name: nonEmpty(device.name),
        status: nonEmpty(device.status)
      }),
    onSkip
  )

export const toCertificate = (
  entry: z.infer<typeof certificateSchema>
): DevelopmentCertificate => {
  const platform = entry.certificatePlatform ?? entry.certificateType?.platform

  return compact({
    serialNumber: entry.serialNumber,
    id: nonEmpty(entry.certificateId),
    name: nonEmpty(entry.name),
    machineName: nonEmpty(entry.machineName),
    machineId: nonEmpty(entry.machineId),
    content: entry.certContent,
    platform: nonEmpty(platform),
    status: nonEmpty(entry.status),
    expiresAt: entry.expirationDate
  })
}

export const toCertificates = (
  response: PlistDict,
  onSkip: (entry: unknown) => void
): DevelopmentCertificate[] =>
  parseList(response.certificates, certificateSchema, toCertificate, onSkip)

const toAppId = (entry: z.infer<typeof appIdSchema>): AppId =>
  compact({
    id: entry.appIdId,
    identifier: entry.identifier,
    name: entry.name,
    features: entry.features ?? ({} as PlistDict),
    expiresAt: entry.expirationDate
  })

export const toAppIds = (
  response: PlistDict,
  onSkip: (entry: unknown) => void
): { appIds: AppId[]; quota: AppIdQuota } => {
  const max = integer.safeParse(response.maxQuantity)
  const available = integer.safeParse(response.availableQuantity)

  return {
    appIds: parseList(response.appIds, appIdSchema, toAppId, onSkip),
    quota: compact({
      max: max.success ? max.data : undefined,
      // Apple sometimes reports a negative or missing quantity; never let that turn into "plenty".
      available: available.success ? Math.max(0, available.data) : 0
    })
  }
}

export const toCreatedAppId = (response: PlistDict): AppId =>
  toAppId(appIdSchema.parse(required(response.appId, 'appId')))

const toAppGroupEntry = (group: z.infer<typeof appGroupSchema>): AppGroup =>
  compact({
    id: group.applicationGroup,
    identifier: group.identifier,
    name: nonEmpty(group.name)
  })

export const toAppGroups = (
  response: PlistDict,
  onSkip: (entry: unknown) => void
): AppGroup[] =>
  parseList(
    response.applicationGroupList,
    appGroupSchema,
    toAppGroupEntry,
    onSkip
  )

export const toAppGroup = (response: PlistDict): AppGroup =>
  toAppGroupEntry(
    appGroupSchema.parse(
      required(response.applicationGroup, 'applicationGroup')
    )
  )

export const toProfile = (response: PlistDict): ProvisioningProfile => {
  const profile = profileSchema.parse(
    required(response.provisioningProfile, 'provisioningProfile')
  )

  return {
    id: profile.provisioningProfileId,
    uuid: profile.UUID,
    name: profile.name,
    data: profile.encodedProfile,
    expiresAt: profile.dateExpire,
    appIdId: profile.appIdId
  }
}

export const toSubmittedCertificate = (
  response: PlistDict
): { serialNumber?: string; id?: string } => {
  const request = response.certRequest
  if (!isPlistDict(request))
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: 'no certRequest'
    })
  const serial = request.serialNum ?? request.serialNumber
  const id = request.certificateId ?? request.certRequestId

  return compact({
    serialNumber: typeof serial === 'string' ? serial : undefined,
    id: typeof id === 'string' ? id : undefined
  })
}
