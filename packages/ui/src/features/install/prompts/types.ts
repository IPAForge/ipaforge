/** How a run's question is answered or declined, and what its Cancel button says. */
export type RunPromptActions = {
  onAnswer: (answer: unknown) => void
  onDecline: () => void
  declineLabelKey: 'install.run.cancelInstall'
}

/** One answer in a pick list: picked first, then confirmed. */
export type PickOption = {
  value: string
  title: string
  description?: string | undefined
  /** What picking it breaks, in the warning colour. */
  warning?: string | undefined
  /** The answer Loadstar would pick: listed first and marked. */
  isSuggested?: boolean | undefined
}

/** The busy state of one answer button while the Engine acts on the chosen one. */
export type AnswerBusy = {
  isPending: boolean
  isDisabled: boolean
}

/** One-click answers that stay on screen, the chosen one busy, while the Engine acts on it. */
export type ChosenAnswer = {
  choose: (key: string, answer: unknown) => () => void
  busy: (key: string) => AnswerBusy
}

/** The apps ticked to receive the pairing file, and how to change them. */
export type PairingChoice = {
  chosen: string[]
  isAllChosen: boolean
  setChosen: (bundleIds: string[]) => void
  toggleAll: () => void
}

/** Who made a development certificate, from the machine name Apple keeps with it. */
export type CertificateOrigin = 'loadstar' | 'sidestore' | 'machine' | 'unknown'

/** The state react-aria hands a pick-list row's class function. */
export type PickRenderState = {
  isSelected: boolean
  isFocusVisible: boolean
  isDisabled: boolean
}
