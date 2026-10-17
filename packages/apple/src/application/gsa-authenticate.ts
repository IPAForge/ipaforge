// One SRP sign-in against GrandSlam, step by step: `init` (with an anisette resync when Apple asks for one), the
// password proof, `complete`, then the server proof and the decrypted session data.

import type { AppleDeps } from '@apple/deps.ts'
import type { AnisetteData } from '@apple/domain/anisette.ts'
import { assertGsaOk, needsAnisetteResync } from '@apple/domain/gsa-status.ts'
import {
  type AppleSession,
  type SecondFactorRequest,
  secondFactorFromStatus
} from '@apple/domain/session.ts'
import { decryptSpd } from '@apple/infrastructure/crypto/session.ts'
import {
  bigintFromBytes,
  bytesFromBigint,
  type ClientEphemeral,
  type ClientProof,
  clientEphemeral,
  clientProof,
  type PasswordProtocol,
  passwordKey,
  serverProof
} from '@apple/infrastructure/crypto/srp.ts'
import {
  clientProvidedData,
  type GsaResponse,
  gsaRequest
} from '@apple/infrastructure/gsa/client.ts'
import { parseApplePlist } from '@apple/infrastructure/plist-diagnostics.ts'
import { plistNumber } from '@apple/infrastructure/plist-fields.ts'
import {
  compact,
  createDict,
  ErrorCode,
  equalBytes,
  fromBase64,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  stringAt
} from '@loadstar/kernel'

const PROTOCOLS: readonly PasswordProtocol[] = ['s2k', 's2k_fo']

export type Resync = (
  data: AnisetteData,
  resyncData: string
) => Promise<AnisetteData>

export type Credentials = {
  readonly appleId: string
  readonly password: string
  readonly signal?: AbortSignal
}

export type Authenticated = {
  readonly session: AppleSession
  readonly secondFactor?: SecondFactorRequest
}

const protocolError = (message: string): LoadstarError =>
  new LoadstarError(ErrorCode.AppleProtocolError, { message })

const bytesField = (dict: PlistDict, key: string): Uint8Array => {
  const value = dict[key]
  if (value instanceof Uint8Array) return value
  if (typeof value === 'string') return fromBase64(value)
  throw protocolError(`GSA response has no ${key}`)
}

const stringField = (dict: PlistDict, key: string): string => {
  const value = stringAt(dict, key)
  if (value === undefined) throw protocolError(`missing ${key}`)
  return value
}

/** Attaches a clock-skew diagnosis when the computer's clock is far from Apple's. */
const checkSkew = (
  deps: AppleDeps,
  skewMs: number | undefined,
  error: LoadstarError
): LoadstarError => {
  if (skewMs === undefined || Math.abs(skewMs) <= deps.config.maxClockSkewMs)
    return error
  return new LoadstarError(ErrorCode.ClockSkew, {
    cause: error,
    data: { skewSeconds: Math.round(skewMs / 1000) }
  })
}

/** Throws the catalogued error for a failed step, reported as clock skew when the clock is the likely cause. */
const assertStepOk = (
  deps: AppleDeps,
  step: GsaResponse,
  operation: string
): void => {
  try {
    assertGsaOk(step.status, operation)
  } catch (error) {
    throw checkSkew(deps, step.clockSkewMs, error as LoadstarError)
  }
}

/** `init`: sends A and gets the salt, iterations and B. Returns the anisette data the exchange continues with. */
const init = async (
  deps: AppleDeps,
  initialAnisette: AnisetteData,
  resync: Resync,
  credentials: Credentials,
  ephemeral: ClientEphemeral
): Promise<{ anisette: AnisetteData; init: GsaResponse }> => {
  let anisette = initialAnisette
  const send = () =>
    gsaRequest(
      deps,
      anisette,
      createDict([
        ['A2k', bytesFromBigint(ephemeral.A)],
        ['cpd', clientProvidedData(deps, anisette)],
        ['o', 'init'],
        ['ps', [...PROTOCOLS]],
        ['u', credentials.appleId]
      ]),
      compact({ signal: credentials.signal })
    )
  let response = await send()
  // hsc 434: Apple wants this machine's anisette resynced first (catalogue). Resync once, then retry.
  if (needsAnisetteResync(response.status)) {
    deps.logger.info(
      'Apple asked for an anisette resync; resyncing and retrying',
      { server: anisette.server }
    )
    anisette = await resync(anisette, response.status.resyncData)
    response = await send()
  }
  assertStepOk(deps, response, 'init')
  return { anisette, init: response }
}

/** The client proof M1 (and session key K) from the password and the `init` answer. */
const provePassword = async (
  credentials: Credentials,
  ephemeral: ClientEphemeral,
  initResponse: PlistDict
): Promise<ClientProof> => {
  const protocol = initResponse.sp === 's2k_fo' ? 's2k_fo' : 's2k'
  const iterations = plistNumber(initResponse.i)
  if (!iterations) throw protocolError('GSA init: no iteration count')
  const salt = bytesField(initResponse, 's')
  const B = bigintFromBytes(bytesField(initResponse, 'B'))
  const key = await passwordKey(
    credentials.password,
    salt,
    iterations,
    protocol
  )

  return clientProof({
    username: credentials.appleId,
    salt,
    passwordKey: key,
    ephemeral,
    B
  })
}

/** `complete`: sends M1. Never retried: a transient failure here must not count as extra wrong attempts. */
const complete = async (
  deps: AppleDeps,
  anisette: AnisetteData,
  credentials: Credentials,
  initResponse: PlistDict,
  M1: Uint8Array
): Promise<GsaResponse> => {
  const cpd = clientProvidedData(deps, anisette)
  const response = await gsaRequest(
    deps,
    anisette,
    createDict([
      ['M1', M1],
      ['c', initResponse.c ?? ''],
      ['cpd', cpd],
      ['o', 'complete'],
      ['u', credentials.appleId]
    ]),
    compact({ retryTransient: false, signal: credentials.signal })
  )
  assertStepOk(deps, response, 'complete')
  return response
}

/** Verifies the server proof M2 and decrypts the session data (`spd`). */
const readSession = async (
  ephemeral: ClientEphemeral,
  proof: ClientProof,
  completeResponse: PlistDict,
  appleId: string,
  anisette: AnisetteData
): Promise<AppleSession> => {
  const M2 = bytesField(completeResponse, 'M2')
  if (!equalBytes(M2, await serverProof(ephemeral.A, proof.M1, proof.K))) {
    throw protocolError('GSA server proof did not verify')
  }
  const spd = parseApplePlist(
    await decryptSpd(proof.K, bytesField(completeResponse, 'spd')),
    'session data (spd)'
  )
  if (!isPlistDict(spd)) throw protocolError('session data is not a dict')
  return compact({
    appleId,
    adsid: stringField(spd, 'adsid'),
    idmsToken: stringField(spd, 'GsIdmsToken'),
    sessionKey: bytesField(spd, 'sk'),
    cookie: bytesField(spd, 'c'),
    anisetteServer: anisette.server,
    firstName: stringAt(spd, 'fn'),
    lastName: stringAt(spd, 'ln')
  })
}

/** One SRP round trip. Returns the decrypted session data and the second-factor requirement, if any. */
export const authenticate = async (
  deps: AppleDeps,
  initialAnisette: AnisetteData,
  resync: Resync,
  credentials: Credentials
): Promise<Authenticated> => {
  const ephemeral = clientEphemeral(deps.randomBytes)
  const started = await init(
    deps,
    initialAnisette,
    resync,
    credentials,
    ephemeral
  )
  const proof = await provePassword(
    credentials,
    ephemeral,
    started.init.response
  )
  const finished = await complete(
    deps,
    started.anisette,
    credentials,
    started.init.response,
    proof.M1
  )
  const session = await readSession(
    ephemeral,
    proof,
    finished.response,
    credentials.appleId,
    started.anisette
  )
  deps.logger.info('GSA complete status', {
    ec: finished.status.ec,
    hsc: finished.status.hsc,
    au: finished.status.au
  })
  return compact({
    session,
    secondFactor: secondFactorFromStatus(finished.status)
  })
}
