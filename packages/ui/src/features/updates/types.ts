import type { UpdateState } from '@ipaforge/rpc'

export type UpdatePhase = UpdateState['phase']

/** An update state in one phase. */
export type UpdateIn<P extends UpdatePhase> = Extract<UpdateState, { phase: P }>
