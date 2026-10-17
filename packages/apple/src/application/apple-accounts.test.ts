import { describe, expect, it, vi } from 'vitest'

import type { AccountStore } from '@apple/application/accounts.ts'
import {
  type ResumeServices,
  resumeAccount
} from '@apple/application/apple-accounts.ts'
import type { AppleDeps } from '@apple/deps.ts'
import type { AppleSession } from '@apple/domain/session.ts'
import {
  createLogger,
  ErrorCode,
  LoadstarError,
  type LogRecord
} from '@loadstar/kernel'

const ID = 'someone@example.com'
const PASSWORD = 'test-password'

const session: AppleSession = {
  appleId: ID,
  adsid: '000123-45-abcd',
  idmsToken: 'test-idms-token',
  sessionKey: new Uint8Array([1, 2, 3]),
  cookie: new Uint8Array([4, 5, 6]),
  anisetteServer: 'Example'
}

const expired = new LoadstarError(ErrorCode.SessionExpired, {
  data: { request: 'apptokens', gsaCode: -22406, hsc: 401 }
})

const setup = (options: { password?: string; tokenError?: unknown }) => {
  const records: LogRecord[] = []
  const logger = createLogger({
    level: 'debug',
    sink: (record) => records.push(record)
  })
  const accounts = {
    list: async () => [
      { id: ID, appleId: ID, health: { bannedOnDevices: [] } }
    ],
    session: async () => session,
    password: async () => options.password,
    update: vi.fn(async () => ({})),
    save: vi.fn(async () => ({}))
  } as unknown as AccountStore & {
    save: ReturnType<typeof vi.fn>
  }
  const signIn = vi.fn(async () => ({
    kind: 'signed_in' as const,
    session: { ...session, idmsToken: 'test-renewed-token' }
  }))
  const services: ResumeServices = {
    deps: {
      logger,
      clock: { now: () => new Date(0) }
    } as unknown as AppleDeps,
    accounts,
    tokens: {
      appToken: async () => {
        if (options.tokenError) throw options.tokenError
        return { app: 'x', token: 't', expiresAt: new Date(1) }
      }
    },
    signIn: { signIn }
  }

  return { services, records, signIn, accounts }
}

const logged = (records: LogRecord[]) => JSON.stringify(records)

describe('resumeAccount', () => {
  it('reuses the saved session while Apple accepts it', async () => {
    const { services, signIn } = setup({})
    expect(await resumeAccount(services, ID)).toEqual({
      kind: 'signed_in',
      session
    })
    expect(signIn).not.toHaveBeenCalled()
  })

  it('signs in again with the saved password when the session expired, without asking', async () => {
    const { services, signIn, accounts, records } = setup({
      password: PASSWORD,
      tokenError: expired
    })
    const result = await resumeAccount(services, ID)

    expect(result.kind).toBe('signed_in')
    expect(signIn).toHaveBeenCalledWith({ appleId: ID, password: PASSWORD })
    expect(accounts.save).toHaveBeenCalledTimes(1)
    expect(records.map((record) => record.msg)).toContain(
      'signing in again with the saved password'
    )
  })

  it('needs the password when the session expired and none is saved, logging why', async () => {
    const { services, records } = setup({ tokenError: expired })

    expect(await resumeAccount(services, ID)).toEqual({
      kind: 'needs_password',
      appleId: ID
    })
    const refusal = records.find(
      (record) => record.msg === 'saved session not accepted'
    )
    expect(refusal?.level).toBe('info')
    expect(refusal?.fields).toMatchObject({
      account: ID,
      code: ErrorCode.SessionExpired,
      request: 'apptokens',
      gsaCode: -22406,
      hsc: 401
    })
    expect(records.map((record) => record.msg)).toContain(
      'no saved password; the password is needed'
    )
  })

  it('never logs the session, its tokens or the password', async () => {
    const { services, records } = setup({
      password: PASSWORD,
      tokenError: expired
    })
    await resumeAccount(services, ID)

    const text = logged(records)
    expect(text).not.toContain(PASSWORD)
    expect(text).not.toContain('test-idms-token')
    expect(text).not.toContain('test-renewed-token')
  })

  it('passes on a failure that is not an expired session', async () => {
    const { services } = setup({
      tokenError: new LoadstarError(ErrorCode.AnisetteUnavailable)
    })
    await expect(resumeAccount(services, ID)).rejects.toMatchObject({
      code: ErrorCode.AnisetteUnavailable
    })
  })
})
