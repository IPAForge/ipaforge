/** Where the setup guide keeps its progress, with the other UI preferences. */
export const GuideKey = {
  status: 'guide.status',
  step: 'guide.step',
  done: 'guide.done',
  team: 'guide.team'
} as const

export const guideStatuses = ['open', 'later', 'finished'] as const
