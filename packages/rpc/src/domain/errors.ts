// The failures the RPC layer itself produces; everything else is the Engine's error, carried across unchanged.

import type { z } from 'zod'

import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** Validation issues, without the rejected values (they may hold secrets such as a password answer). */
const issuesOf = (error: z.ZodError): string[] =>
  error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
  )

export const invalidMessage = (error: z.ZodError): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidRpcMessage, {
    message: 'invalid RPC message',
    data: { issues: issuesOf(error) }
  })

export const unknownReference = (
  kind: 'run' | 'checkpoint',
  id: string
): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidRpcMessage, {
    message: `unknown ${kind}`,
    data: { [kind]: id }
  })

export const runIdInUse = (id: string): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidRpcMessage, {
    message: 'run id already in use',
    data: { run: id }
  })

export const subscriptionIdInUse = (id: string): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidRpcMessage, {
    message: 'subscription id already in use',
    data: { subscription: id }
  })

export const disconnected = (): IPAForgeError =>
  new IPAForgeError(ErrorCode.RpcDisconnected, {
    message: 'the RPC channel closed'
  })

export const timedOut = (timeoutMs: number): IPAForgeError =>
  new IPAForgeError(ErrorCode.RpcTimeout, {
    message: 'no answer to the RPC request',
    data: { timeoutMs }
  })

/** Mirrors the Engine's run handle: answering or declining with no question waiting is a programming error. */
export const noPrompt = (): IPAForgeError =>
  new IPAForgeError(ErrorCode.Unexpected, { message: 'no prompt is waiting' })
