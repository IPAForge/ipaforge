// Each step's share of the progress bar, roughly in proportion to how long it takes: transfers and signing
// dominate, quick Apple requests and checks take a sliver.
export const StepWeight = {
  check: 1,
  appleRequest: 1,
  download: 6,
  inspect: 1,
  provision: 2,
  sign: 4,
  install: 6,
  pairing: 1
} as const
