// The failures the RPC layer itself produces; everything else is the Engine's error, carried across unchanged.

import type { z } from 'zod'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** Validation issues, without the rejected values (they may hold secrets such as a password answer). */
const issuesOf = (error: z.ZodError): string[] =>
  error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
  )

export const invalidMessage = (error: z.ZodError): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidRpcMessage, {
    message: 'invalid RPC message',
    data: { issues: issuesOf(error) }
  })

export const unknownReference = (
  kind: 'run' | 'checkpoint',
  id: string
): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidRpcMessage, {
    message: `unknown ${kind}`,
    data: { [kind]: id }
  })

export const runIdInUse = (id: string): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidRpcMessage, {
    message: 'run id already in use',
    data: { run: id }
  })

export const disconnected = (): LoadstarError =>
  new LoadstarError(ErrorCode.RpcDisconnected, {
    message: 'the RPC channel closed'
  })

export const timedOut = (timeoutMs: number): LoadstarError =>
  new LoadstarError(ErrorCode.RpcTimeout, {
    message: 'no answer to the RPC request',
    data: { timeoutMs }
  })

/** Mirrors the Engine's run handle: answering or declining with no question waiting is a programming error. */
export const noPrompt = (): LoadstarError =>
  new LoadstarError(ErrorCode.Unexpected, { message: 'no prompt is waiting' })
