import { questionKeys } from '@ui/features/install/prompts/constants.ts'

/** The words for a question this version can't ask yet; "another question" for one it doesn't know. */
export const questionKey = (kind: string) =>
  kind in questionKeys
    ? questionKeys[kind as keyof typeof questionKeys]
    : 'install.run.unsupportedPrompt.question.other'
