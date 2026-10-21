#!/usr/bin/env bash
# Makes the website's screenshots (ipaforge.com) of the current checkout: the screens it shows, in English, light and
# dark, as PNGs in packages/ui/website-screenshots/ (ignored by git). They're made in Playwright's Docker image, the
# one CI runs the browser tests in, so fonts and anti-aliasing match. Needs Docker; works from any system.
#
#   pnpm --filter @ipaforge/ui screenshots
#
# The checkout (tracked and new files, not node_modules) is copied into a temporary folder and the screenshots are
# taken there; only the images come back.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"
ROOT="$(git rev-parse --show-toplevel)"
OUT="packages/ui/website-screenshots"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
git ls-files -co --exclude-standard -z | rsync -a --from0 --files-from=- ./ "$WORK/"

docker run --rm --ipc=host -v "$WORK:/work" -w /work -e CI=1 -e VITE_WEBSITE_SCREENSHOTS=1 \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 "$IMAGE" \
  bash -c 'corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ipaforge/ui exec vitest run -c vitest.browser.config.ts src/website-screens.browser.test.tsx'

rm -rf "$OUT"
mkdir -p "$OUT"
find "$WORK/packages/ui/src" -path '*/website/*.png' -exec cp {} "$OUT/" \;
echo "made $(find "$OUT" -name '*.png' | wc -l | tr -d ' ') website screenshots in $OUT"
