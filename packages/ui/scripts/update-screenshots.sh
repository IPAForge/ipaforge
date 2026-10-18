#!/usr/bin/env bash
# Rebuilds the reference screenshots the browser tests compare against. They are made on Linux only, in the same
# Playwright image CI runs them in, so fonts and anti-aliasing match. Needs Docker; works from any system.
#
#   pnpm --filter @ipaforge/ui test:browser:update
#
# The checkout (tracked and new files, not node_modules) is copied into a temporary folder, the tests run there
# with --update, and only the *-linux.png images come back.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"
ROOT="$(git rev-parse --show-toplevel)"
SHOTS="packages/ui/src/__screenshots__"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
git ls-files -co --exclude-standard -z | rsync -a --from0 --files-from=- ./ "$WORK/"

docker run --rm --ipc=host -v "$WORK:/work" -w /work -e CI=1 -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 "$IMAGE" \
  bash -c 'corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ipaforge/ui exec vitest run -c vitest.browser.config.ts --update'

mkdir -p "$SHOTS"
rsync -a --delete --include='*/' --include='*-linux.png' --exclude='*' "$WORK/$SHOTS/" "$SHOTS/"
echo "updated $(find "$SHOTS" -name '*-linux.png' | wc -l | tr -d ' ') Linux reference images in $SHOTS"
