// ESLint does two things Biome can't: blank lines between statements, and
// SonarSource's rules (eslint-plugin-sonarjs). Biome does everything else
// (formatting, imports, lint). Plugins come from tooling/eslint.
import { parser, sonarjs, stylistic } from '@loadstar/tooling-eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/coverage/**',
      '**/node_modules/**',
      '.turbo/**',
      '.cache/**',
      'fixtures/**',
      'scripts/__fixtures__/**',
      'tooling/biome/__fixtures__/**'
    ]
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser },
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        // a blank line after the import block (Biome's groups decide the lines between imports)
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        // a blank line before `return` when a declaration precedes it
        { blankLine: 'always', prev: ['const', 'let'], next: 'return' }
      ]
    }
  },
  {
    ...sonarjs.configs.recommended,
    files: ['**/*.{ts,tsx}'],
    // TODO(sonar-ui): packages/ui is cleaned up separately; drop this ignore then.
    ignores: ['packages/ui/**'],
    rules: {
      ...sonarjs.configs.recommended.rules,
      // S4782: with exactOptionalPropertyTypes, `?` and `| undefined` mean different things.
      'sonarjs/no-redundant-optional': 'off',
      // Biome's noUnusedImports already fails on these.
      'sonarjs/unused-import': 'off',
      // Biome's noUnusedVariables already warns, and allows the `_` prefix the conventions use.
      'sonarjs/no-unused-vars': 'off'
    }
  },
  {
    // Maintainer scripts and tests run `codesign`, `openssl` and `unzip` from PATH on purpose.
    files: [
      'scripts/**',
      'packages/*/scripts/**',
      'apps/desktop/scripts/**',
      'fixtures/**',
      '**/*.test.ts'
    ],
    rules: { 'sonarjs/no-os-command-from-path': 'off' }
  }
]
