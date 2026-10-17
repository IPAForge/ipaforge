import {
  LOCKDOWN_PROTOCOL_VERSION,
  LOCKDOWN_QUERY_TYPE
} from '@device/domain/constants.ts'
import type { LockdownPairRecord } from '@device/domain/pairing/types.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { plistInteger } from '@device/infrastructure/framing/plist-values.ts'
import { LockdownErrorName } from '@device/infrastructure/lockdown/constants.ts'
import {
  isLockdownError,
  lockdownError
} from '@device/infrastructure/lockdown/errors.ts'
import type { LockdownClient } from '@device/infrastructure/lockdown/types.ts'
import {
  createDict,
  ErrorCode,
  LoadstarError,
  type Logger,
  type PlistDict,
  type PlistValue
} from '@loadstar/kernel'

const pairRecordDict = (record: LockdownPairRecord): PlistDict =>
  createDict([
    ['DeviceCertificate', record.deviceCertificate],
    ['HostCertificate', record.hostCertificate],
    ['RootCertificate', record.rootCertificate],
    ['HostID', record.hostId],
    ['SystemBUID', record.systemBuid]
  ])

const MAX_PORT = 0xffff

const isValidPort = (port: number | undefined): port is number =>
  port !== undefined && port > 0 && port <= MAX_PORT

export const createLockdownClient = (
  link: Link,
  options: { label: string; limits: FrameLimits; logger: Logger }
) => {
  const { label, limits, logger } = options

  const request = async (
    name: string,
    fields: readonly (readonly [string, PlistValue])[] = []
  ): Promise<PlistDict> => {
    logger.debug('lockdown request', { request: name })
    await sendPlist(
      link,
      createDict([['Label', label], ['Request', name], ...fields])
    )
    const response = await receivePlist(link, limits, 'lockdownd')
    const error = response.Error
    if (typeof error === 'string') throw lockdownError(error, name)
    return response
  }

  const client: LockdownClient = {
    queryType: async () => {
      const response = await request('QueryType')
      const type = response.Type
      if (type !== LOCKDOWN_QUERY_TYPE) {
        throw new LoadstarError(ErrorCode.DeviceProtocolError, {
          message: `unexpected lockdown type ${String(type)}`
        })
      }
      return type
    },

    getValue: async (key, domain) => {
      try {
        const response = await request('GetValue', [
          ...(domain ? [['Domain', domain] as const] : []),
          ...(key ? [['Key', key] as const] : [])
        ])

        return response.Value
      } catch (error) {
        if (isLockdownError(error, LockdownErrorName.MissingValue))
          return undefined
        throw error
      }
    },

    setValue: async (domain, key, value) => {
      await request('SetValue', [
        ['Domain', domain],
        ['Key', key],
        ['Value', value]
      ])
    },

    pair: async (record) => {
      const response = await request('Pair', [
        ['PairRecord', pairRecordDict(record)],
        ['PairingOptions', createDict([['ExtendedPairingErrors', true]])],
        ['ProtocolVersion', LOCKDOWN_PROTOCOL_VERSION]
      ])

      return response.EscrowBag instanceof Uint8Array
        ? response.EscrowBag
        : undefined
    },

    validatePair: async (record) => {
      await request('ValidatePair', [
        ['PairRecord', pairRecordDict(record)],
        ['ProtocolVersion', LOCKDOWN_PROTOCOL_VERSION]
      ])
    },

    startSession: async (hostId, systemBuid) => {
      const response = await request('StartSession', [
        ['HostID', hostId],
        ['SystemBUID', systemBuid]
      ])
      const sessionId = response.SessionID
      if (typeof sessionId !== 'string') {
        throw new LoadstarError(ErrorCode.DeviceProtocolError, {
          message: 'StartSession returned no SessionID'
        })
      }
      return { sessionId, enableSessionSsl: response.EnableSessionSSL === true }
    },

    startTls: (credentials) => link.startTls(credentials),

    startService: async (service, escrowBag) => {
      const response = await request('StartService', [
        ['Service', service],
        ...(escrowBag ? [['EscrowBag', escrowBag] as const] : [])
      ])
      const port = plistInteger(response.Port)
      if (!isValidPort(port)) {
        throw new LoadstarError(ErrorCode.ServiceUnavailable, {
          message: `${service}: no port`,
          data: { service }
        })
      }
      logger.debug('service started', { service, port })
      return { port, enableServiceSsl: response.EnableServiceSSL === true }
    },

    stopSession: async (sessionId) => {
      await request('StopSession', [['SessionID', sessionId]])
    },

    close: () => link.close()
  }

  return client
}
