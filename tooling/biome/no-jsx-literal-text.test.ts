import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const fixtures = join(import.meta.dirname, '__fixtures__')
const biome = join(
  import.meta.dirname,
  '..',
  '..',
  'node_modules',
  '@biomejs',
  'biome',
  'bin',
  'biome'
)

type Diagnostic = {
  readonly category: string
  readonly location: {
    readonly path: string
    readonly start: { readonly line: number }
  }
}

/** Lints one fixture with only the plugin enabled (`__fixtures__/biome.json`) and returns "line category" pairs. */
const lint = (file: string): string[] => {
  const result = spawnSync(
    process.execPath,
    [
      biome,
      'lint',
      '--config-path=.',
      '--reporter=json',
      `no-jsx-literal-text/${file}`
    ],
    { cwd: fixtures, encoding: 'utf8' }
  )
  const report = JSON.parse(result.stdout) as { diagnostics: Diagnostic[] }

  return report.diagnostics.map(
    ({ location, category }) => `${location.start.line} ${category}`
  )
}

describe('no-jsx-literal-text.grit', () => {
  it('reports JSX text and string literals in user-visible props', () => {
    expect(lint('rejected.tsx')).toEqual([
      '3 plugin', // Hello there (the text node starts after <section>)
      '5 plugin', // <h1>Install SideStore</h1>
      '6 plugin', // alt="Logo"
      '7 plugin', // aria-label="Close"
      '10 plugin', // title={"Name"}
      '10 plugin', // placeholder={`Type ${count}`}
      '11 plugin', // label="Apple ID"
      '12 plugin' // {count} apps
    ])
  })

  it('allows translated text, punctuation and literals in props nobody sees', () => {
    expect(lint('allowed.tsx')).toEqual([])
  })
})
