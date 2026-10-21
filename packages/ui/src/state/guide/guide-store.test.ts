import { describe, expect, it } from 'vitest'

import { createMemoryPreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import { GuideKey } from '@ui/state/guide/constants.ts'
import { createGuideStore } from '@ui/state/guide/guide-store.ts'

describe('guide store', () => {
  it('starts closed, or as it was left', () => {
    expect(
      createGuideStore(createMemoryPreferencesStore()).getState().status
    ).toBe('finished')
    expect(
      createGuideStore(
        createMemoryPreferencesStore({ [GuideKey.status]: 'later' })
      ).getState().status
    ).toBe('later')
  })

  it('keeps its progress: steps done, the step shown, the team; Finish later and the banner', () => {
    const preferences = createMemoryPreferencesStore()
    const guide = createGuideStore(preferences)
    guide.open()
    guide.complete('welcome', 'computer')
    guide.chooseTeam('TEAM1')
    guide.later()

    const again = createGuideStore(preferences).getState()
    expect(again).toMatchObject({
      status: 'later',
      step: 'computer',
      done: ['welcome'],
      teamId: 'TEAM1',
      isBannerHidden: false
    })

    guide.hideBanner()
    expect(guide.getState().isBannerHidden).toBe(true)
    guide.finish()
    expect(guide.getState()).toMatchObject({
      status: 'finished',
      step: 'welcome'
    })
    guide.open('iphone')
    expect(guide.getState()).toMatchObject({ status: 'open', step: 'iphone' })
  })
})
