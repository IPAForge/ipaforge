/** How a run's question is answered or declined, and what its Cancel button says. */
export type RunPromptActions = {
  onAnswer: (answer: unknown) => void
  onDecline: () => void
  declineLabelKey: 'install.run.cancelInstall'
}
