// Anisette v3: the server never sees Apple credentials. It provisions a virtual machine identity with Apple
// (we relay the handshake between the server's WebSocket and Apple's provisioning endpoints), then turns the
// resulting `adi.pb` into one-time headers on request.

import { z } from 'zod'

import {
  ANISETTE_SERIAL_NUMBER,
  ANISETTE_TIME_ZONE,
  appleTimestamp,
  deviceIdFor,
  localUserIdFor
} from '@apple/domain/anisette.ts'
import type { WebSocketLike } from '@apple/domain/ports/types.ts'
import type { AnisetteServer, ClientIdentity } from '@apple/domain/types.ts'
import type {
  HeadersResult,
  SocketMessage
} from '@apple/infrastructure/anisette/types.ts'
import {
  JSON_CONTENT_TYPE,
  PLIST_CONTENT_TYPE
} from '@apple/infrastructure/apple-headers.ts'
import { bagUrl } from '@apple/infrastructure/gsa/url-bag.ts'
import { fetchApple } from '@apple/infrastructure/http.ts'
import type { AppleDeps } from '@apple/types.ts'
import {
  compact,
  createDict,
  ErrorCode,
  fromBase64,
  IPAForgeError,
  isPlistDict,
  type PlistDict,
  parsePlist,
  serializeXmlPlist,
  toBase64,
  trimEndChar,
  utf8Decode
} from '@ipaforge/kernel'

const clientInfoSchema = z.looseObject({
  client_info: z.string().min(1),
  user_agent: z.string().min(1)
})

const headersSchema = z.discriminatedUnion('result', [
  z.looseObject({
    result: z.literal('Headers'),
    'X-Apple-I-MD': z.string(),
    'X-Apple-I-MD-M': z.string(),
    'X-Apple-I-MD-RINFO': z.union([z.string(), z.number()]).transform(String)
  }),
  z.looseObject({
    result: z.literal('GetHeadersError'),
    message: z.string().optional()
  })
])

export const socketMessageSchema = z.looseObject({ result: z.string() })

const json = (bytes: Uint8Array): unknown => JSON.parse(utf8Decode(bytes))

const toWebSocketUrl = (address: string, path: string): string =>
  `${trimEndChar(address.replace(/^http/, 'ws'), '/')}${path}`

/** `retry: false` for a health check: one request, so a server that answers with an error says so at once. */
export const fetchClientInfo = async (
  deps: AppleDeps,
  server: AnisetteServer,
  timeoutMs = deps.config.timeouts.requestMs,
  retry = true
): Promise<ClientIdentity> => {
  const response = await fetchApple(deps, `${server.address}/v3/client_info`, {
    timeoutMs,
    retryTransient: retry
  })
  const parsed = clientInfoSchema.parse(json(response.body))

  return { clientInfo: parsed.client_info, userAgent: parsed.user_agent }
}

/** Headers Apple's provisioning endpoints expect from a machine with this identifier. */
const machineHeaders = async (
  deps: AppleDeps,
  identity: ClientIdentity,
  identifier: Uint8Array
): Promise<Record<string, string>> => ({
  'X-Mme-Client-Info': identity.clientInfo,
  'User-Agent': identity.userAgent,
  'X-Apple-I-MD-LU': await localUserIdFor(identifier),
  'X-Mme-Device-Id': deviceIdFor(identifier),
  'X-Apple-I-Client-Time': appleTimestamp(deps.clock.now()),
  'X-Apple-I-TimeZone': ANISETTE_TIME_ZONE,
  'X-Apple-Locale': deps.config.locale,
  'X-Apple-I-SRL-NO': ANISETTE_SERIAL_NUMBER
})

const applePlist = async (
  deps: AppleDeps,
  url: string,
  headers: Record<string, string>,
  request: PlistDict
): Promise<PlistDict> => {
  const response = await fetchApple(deps, url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': PLIST_CONTENT_TYPE, Accept: '*/*' },
    body: serializeXmlPlist(
      createDict([
        ['Header', createDict()],
        ['Request', request]
      ])
    )
  })
  const value = parsePlist(response.body)
  const inner = isPlistDict(value) ? value.Response : undefined
  if (!isPlistDict(inner))
    throw new IPAForgeError(ErrorCode.AppleProtocolError, {
      message: `${url}: no Response`
    })
  return inner
}

const provisioningUrls = async (deps: AppleDeps) => ({
  start: await bagUrl(deps, 'midStartProvisioning'),
  finish: await bagUrl(deps, 'midFinishProvisioning')
})

const anisetteError = (message: string, cause?: unknown): IPAForgeError =>
  new IPAForgeError(ErrorCode.AnisetteUnavailable, compact({ message, cause }))

const parseSocketMessage = (value: unknown): SocketMessage => {
  const parsed = socketMessageSchema.safeParse(value)
  if (!parsed.success) throw anisetteError('unexpected anisette message')
  return parsed.data
}

/** Pull-based reader over a WebSocket's JSON messages. */
const socketReader = (socket: WebSocketLike, timeoutMs: number) => {
  const queue: unknown[] = []
  const waiters: {
    resolve: (value: unknown) => void
    reject: (error: unknown) => void
  }[] = []
  let failure: IPAForgeError | undefined
  const fail = (error: IPAForgeError) => {
    failure ??= error
    for (const waiter of waiters.splice(0)) waiter.reject(failure)
  }
  const deliver = (message: unknown) => {
    const waiter = waiters.shift()
    if (waiter) waiter.resolve(message)
    else queue.push(message)
  }
  socket.onmessage = (event) => {
    let message: unknown
    try {
      message = JSON.parse(
        typeof event.data === 'string' ? event.data : String(event.data)
      )
    } catch (error) {
      fail(anisetteError('anisette sent invalid JSON', error))
      return
    }
    deliver(message)
  }
  socket.onerror = () => fail(anisetteError('anisette WebSocket error'))
  socket.onclose = (event) =>
    fail(anisetteError(`anisette closed the session (${event.code ?? '?'})`))

  /** Waits for the next message, failing after `timeoutMs`. */
  const wait = (): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(anisetteError('anisette provisioning timed out')),
        timeoutMs
      )
      waiters.push({
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
    })

  const next = async (): Promise<SocketMessage> => {
    if (queue.length > 0) return parseSocketMessage(queue.shift())
    if (failure) throw failure
    return parseSocketMessage(await wait())
  }

  return { next }
}

const expectStep = (message: { result: string }, wanted: string): void => {
  if (message.result !== wanted) {
    throw new IPAForgeError(ErrorCode.AnisetteUnavailable, {
      message: `anisette provisioning: expected ${wanted}, got ${message.result}`,
      data: { anisetteResult: message.result }
    })
  }
}

const stringField = (dict: PlistDict, key: string): string => {
  const value = dict[key]
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array) return toBase64(value)
  throw new IPAForgeError(ErrorCode.AppleProtocolError, {
    message: `provisioning response has no ${key}`
  })
}

/** Runs the provisioning handshake and returns the server's `adi.pb` for this identifier. */
export const provisionV3 = async (
  deps: AppleDeps,
  server: AnisetteServer,
  identifier: Uint8Array,
  identity: ClientIdentity
): Promise<Uint8Array> => {
  const headers = await machineHeaders(deps, identity, identifier)
  const urls = await provisioningUrls(deps)
  const socket = deps.webSocket(
    toWebSocketUrl(server.address, '/v3/provisioning_session')
  )
  const reader = socketReader(socket, deps.config.timeouts.provisioningMs)
  try {
    expectStep(await reader.next(), 'GiveIdentifier')
    socket.send(JSON.stringify({ identifier: toBase64(identifier) }))

    expectStep(await reader.next(), 'GiveStartProvisioningData')
    const start = await applePlist(deps, urls.start, headers, createDict())
    socket.send(JSON.stringify({ spim: stringField(start, 'spim') }))

    const end = await reader.next()
    expectStep(end, 'GiveEndProvisioningData')
    const cpim = typeof end.cpim === 'string' ? end.cpim : ''
    const finish = await applePlist(
      deps,
      urls.finish,
      headers,
      createDict([['cpim', cpim]])
    )
    socket.send(
      JSON.stringify({
        ptm: stringField(finish, 'ptm'),
        tk: stringField(finish, 'tk')
      })
    )

    const done = await reader.next()
    expectStep(done, 'ProvisioningSuccess')
    if (typeof done.adi_pb !== 'string') {
      throw new IPAForgeError(ErrorCode.AnisetteUnavailable, {
        message: 'provisioning succeeded without adi_pb'
      })
    }
    deps.logger.info('anisette provisioned', { server: server.name })
    return fromBase64(done.adi_pb)
  } finally {
    socket.close()
  }
}

/** One-time machine headers for this provisioned identifier. */
export const getHeadersV3 = async (
  deps: AppleDeps,
  server: AnisetteServer,
  identifier: Uint8Array,
  adiPb: Uint8Array,
  /** Resync data (`X-Apple-I-MD-DATA`, base64) from a GSA hsc 434 answer. */
  resyncData?: string
): Promise<HeadersResult> => {
  const body: Record<string, string> = {
    identifier: toBase64(identifier),
    adi_pb: toBase64(adiPb)
  }
  if (resyncData) {
    body.sim = resyncData
    body.device_id = deviceIdFor(identifier)
    body.md_lu = await localUserIdFor(identifier)
  }
  const response = await fetchApple(deps, `${server.address}/v3/get_headers`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
    body: JSON.stringify(body)
  })
  const parsed = headersSchema.parse(json(response.body))
  if (parsed.result === 'GetHeadersError')
    return { kind: 'not_provisioned', message: parsed.message ?? '' }
  return {
    kind: 'headers',
    headers: {
      'X-Apple-I-MD': parsed['X-Apple-I-MD'],
      'X-Apple-I-MD-M': parsed['X-Apple-I-MD-M'],
      'X-Apple-I-MD-RINFO': parsed['X-Apple-I-MD-RINFO']
    }
  }
}

/** The full header set for a request, from the server's one-time headers plus this machine's identity. */
export const completeHeaders = async (
  deps: AppleDeps,
  identifier: Uint8Array,
  oneTime: Record<string, string>
): Promise<Record<string, string>> => ({
  ...oneTime,
  'X-Apple-I-MD-LU': await localUserIdFor(identifier),
  'X-Mme-Device-Id': deviceIdFor(identifier),
  'X-Apple-I-SRL-NO': ANISETTE_SERIAL_NUMBER,
  'X-Apple-I-Client-Time': appleTimestamp(deps.clock.now()),
  'X-Apple-I-TimeZone': ANISETTE_TIME_ZONE,
  'X-Apple-Locale': deps.config.locale
})
