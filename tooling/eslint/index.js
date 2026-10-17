// typescript-eslint parses with the TypeScript JS API, which TypeScript 7 (the
// native compiler the rest of the repo uses) doesn't ship. This package depends
// on TypeScript 6, so the parser resolves that one. ESLint never asks the
// parser for type information: the blank-line rule doesn't need it, and the
// SonarSource rules that do are skipped without it.
export { default as stylistic } from '@stylistic/eslint-plugin'
export { default as sonarjs } from 'eslint-plugin-sonarjs'
export { parser } from 'typescript-eslint'
