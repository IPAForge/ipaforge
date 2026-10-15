import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { checkBoundaries, findImports } from './check-boundaries.ts'

const fixtures = join(import.meta.dirname, '__fixtures__', 'boundaries')

describe('checkBoundaries', () => {
  it('passes a clean workspace, ignoring comments, strings and template literals', () => {
    const result = checkBoundaries(join(fixtures, 'clean'))
    expect(result.violations).toEqual([])
    expect(result.filesChecked).toBe(5) // index.test.ts is scanned for import style only (it may use node:fs)
  })

  it('reports every rule with file and line', () => {
    const { violations } = checkBoundaries(join(fixtures, 'dirty'))
    const summary = violations.map(
      (v) =>
        `${v.file.split('packages/')[1]}:${v.line} ${v.rule} ${v.specifier}`
    )
    expect(summary).toEqual([
      'installer/src/index.ts:2 relative-import ./sibling.ts',
      'installer/src/index.ts:3 foreign-subpath @kernel/bytes/index.ts',
      'kernel/src/index.ts:1 node-builtin node:fs',
      'kernel/src/index.ts:2 node-builtin path',
      'mystery/src/index.ts:1 unknown-package @loadstar/kernel',
      'signer/src/index.ts:1 platform-module electron',
      'signer/src/index.ts:2 deep-import @loadstar/kernel/src/internal',
      'signer/src/index.ts:3 forbidden-edge @loadstar/device',
      'signer/src/index.ts:4 escape ../../installer/src/index.ts'
    ])
  })
})

describe('findImports', () => {
  it('finds static, side-effect, re-export, dynamic and require specifiers', () => {
    const source = [
      'import a from "a";',
      'import "b";',
      'export { c } from "c";',
      "const d = await import('d');",
      'const e = require("e");',
      'import {',
      '  f,',
      '} from "f";'
    ].join('\n')
    expect(findImports(source)).toEqual([
      { specifier: 'a', line: 1 },
      { specifier: 'b', line: 2 },
      { specifier: 'c', line: 3 },
      { specifier: 'd', line: 4 },
      { specifier: 'e', line: 5 },
      { specifier: 'f', line: 8 }
    ])
  })
})
