import type { ComponentType } from 'react'

import { AppleIdStep } from '@ui/features/guide/steps/apple-id-step.tsx'
import { AroundStep } from '@ui/features/guide/steps/around-step.tsx'
import { ComputerStep } from '@ui/features/guide/steps/computer-step.tsx'
import { InstallStep } from '@ui/features/guide/steps/install-step.tsx'
import { IphoneStep } from '@ui/features/guide/steps/iphone-step.tsx'
import { OnPhoneStep } from '@ui/features/guide/steps/on-phone-step.tsx'
import { WelcomeStep } from '@ui/features/guide/steps/welcome-step.tsx'
import type { GuideStep } from '@ui/features/guide/types.ts'

/** Each step's page. */
export const guideStepPages: Record<GuideStep, ComponentType> = {
  welcome: WelcomeStep,
  computer: ComputerStep,
  iphone: IphoneStep,
  appleid: AppleIdStep,
  install: InstallStep,
  onphone: OnPhoneStep,
  around: AroundStep
}
