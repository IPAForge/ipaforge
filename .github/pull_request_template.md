## What

<!-- What does this change and why? Link the roadmap phase / plan task (e.g. Phase 3, Task 4). -->

## How it was verified

<!-- Tests added/updated, fixtures, manual steps (device model + iOS version for device work). -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm check:boundaries` and `pnpm test` pass
- [ ] `packages/*/src` stays platform-free; absolute `@<package>/…` imports; arrow functions
- [ ] User-facing errors use an `ErrorCode` (new codes documented)
- [ ] Docs updated (`docs/`, `AGENTS.md`) when behaviour or structure changed
