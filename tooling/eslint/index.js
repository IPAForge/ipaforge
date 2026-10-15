// typescript-eslint parses with the TypeScript JS API, which TypeScript 7 (the
// native compiler the rest of the repo uses) doesn't ship. This package depends
// on TypeScript 6, so the parser resolves that one. ESLint only adds blank
// lines, so the parser never needs type information.
export { default as stylistic } from '@stylistic/eslint-plugin'
export { parser } from 'typescript-eslint'
