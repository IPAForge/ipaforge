// ESLint does one thing here: blank lines between statements, which Biome can't format.
// Biome does everything else (formatting, imports, lint). Plugins come from tooling/eslint.
import { parser, stylistic } from '@loadstar/tooling-eslint'

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
  }
]
