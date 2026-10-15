import { parse } from '@formatjs/icu-messageformat-parser'
import { isStructurallySame } from '@formatjs/icu-messageformat-parser/manipulator.js'
import { describe, expect, it } from 'vitest'

import {
  type MessageTree,
  pseudoLocalize,
  pseudoLocalizeTree
} from '@ui/i18n/pseudo-locale.ts'
import en from '@ui/locales/en.json'

const leaves = (tree: MessageTree): string[] =>
  Object.values(tree).flatMap((value) =>
    typeof value === 'string' ? [value] : leaves(value)
  )

describe('pseudoLocalize', () => {
  it('accents, brackets and pads plain text by about 40 %', () => {
    const pseudo = pseudoLocalize('Install SideStore')
    expect(pseudo).toBe('[Îñšţåļļ ŠîðéŠţöŕé~~~~~~~]')
    expect(pseudo.length / 'Install SideStore'.length).toBeGreaterThanOrEqual(
      1.4
    )
  })

  it('keeps arguments, plural keys and # untouched', () => {
    const message =
      '{count, plural, =0 {No devices yet} one {# device} other {# devices}} for {name}'
    const pseudo = pseudoLocalize(message)
    expect(pseudo).toContain('{name}')
    expect(pseudo).toContain('=0{Ñö ðéṽîçéš ýéţ}')
    expect(pseudo).toContain('one{# ðéṽîçé}')
    expect(isStructurallySame(parse(message), parse(pseudo)).success).toBe(true)
  })

  it('keeps apostrophes from breaking ICU', () => {
    expect(() =>
      parse(pseudoLocalize("The computer isn't trusted"))
    ).not.toThrow()
  })

  it('turns every English message into valid ICU with the same placeholders', () => {
    const source = leaves(en)
    const pseudo = leaves(pseudoLocalizeTree(en))
    expect(pseudo).toHaveLength(source.length)
    source.forEach((message, index) => {
      expect(
        isStructurallySame(parse(message), parse(pseudo[index] ?? '')).success
      ).toBe(true)
    })
  })
})
