import { describe, expect, it } from 'vitest'

import { ICON_TINTS } from '@ui/components/constants.ts'
import { iconColors } from '@ui/components/utils/icon-colors.ts'

describe('iconColors', () => {
  it("uses the source's tint, with a letter that reads on it", () => {
    expect(iconColors('Feather', '#c2185b')).toEqual({
      background: '#c2185b',
      color: '#ffffff'
    })
    expect(iconColors('Lemon', '#ffe066').color).toBe('#111827')
  })

  it('picks the same palette colour for the same name, everywhere', () => {
    const { background } = iconColors('SideStore')

    expect(ICON_TINTS).toContain(background)
    expect(iconColors('SideStore').background).toBe(background)
    expect(iconColors('SideStore').color).toBe('#ffffff')
  })
})
