import type { checkLooks, guideSteps } from '@ui/features/guide/constants.ts'

export type GuideStep = (typeof guideSteps)[number]

export type CheckState = keyof typeof checkLooks

/** The computer's system, for which fix to show. */
export type HostSystem = 'mac' | 'windows' | 'linux'
