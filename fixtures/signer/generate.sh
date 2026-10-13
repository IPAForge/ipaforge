#!/usr/bin/env bash
# Regenerates the signer golden fixtures. macOS only (needs Xcode's iOS SDK and Apple `codesign`).
#
#   inputs/    unsigned (or previously signed) binaries and bundles we feed to @loadstar/signer
#   expected/  the same inputs ad-hoc signed by Apple `codesign` — the byte-exact oracle
#   manifest.json  one entry per case + toolchain versions
#
# Usage: fixtures/signer/generate.sh [--check]   (--check: regenerate into a temp dir and diff)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE"
CHECK=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK=1
  OUT="$(mktemp -d)"
  trap 'rm -rf "$OUT"' EXIT
fi

log() { printf '[fixtures] %s\n' "$*" >&2; }

[[ "$(uname)" == "Darwin" ]] || { log "macOS required"; exit 1; }
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
SDK_VERSION="$(xcrun --sdk iphoneos --show-sdk-version)"
CODESIGN_VERSION="$(what /usr/bin/codesign | sed -n 's/.*PROJECT:\(codesign-[0-9.]*\).*/\1/p' | head -1)"
CLANG_VERSION="$(xcrun --sdk iphoneos clang --version | head -1)"
log "sdk=$SDK_VERSION $CODESIGN_VERSION"

SRC="$HERE/src"
ENT="$HERE/entitlements"
IN="$OUT/inputs"
EXP="$OUT/expected"
rm -rf "$IN" "$EXP"
mkdir -p "$IN" "$EXP"

cc() { # cc <out> <minos> <archs...> -- <extra args...>
  local out="$1" minos="$2"; shift 2
  local archs=()
  while [[ "$1" != "--" ]]; do archs+=(-arch "$1"); shift; done
  shift
  xcrun --sdk iphoneos clang -isysroot "$SDK" "${archs[@]}" -miphoneos-version-min="$minos" \
    -Os -Wl,-headerpad,0x200 "$@" -o "$out"
}

sign() { # sign <path> <identifier|-> <entitlements|-> ; ad-hoc, deterministic
  local path="$1" ident="$2" ent="$3" args=(-f -s - --timestamp=none)
  [[ "$ident" != "-" ]] && args+=(-i "$ident")
  [[ "$ent" != "-" ]] && args+=(--generate-entitlement-der --entitlements "$ent")
  codesign "${args[@]}" "$path" 2>/dev/null
}

CASES=()
add_case() { CASES+=("$1"); }

# ---------------------------------------------------------------- loose binaries
for minos in 10.0 14.0 16.0; do
  name="thin-min${minos%%.*}"
  cc "$IN/$name" "$minos" arm64 -- "$SRC/main.c"
  cp "$IN/$name" "$EXP/$name"
  sign "$EXP/$name" "com.loadstar.fixture.$name" "$ENT/app.plist"
  add_case "{\"name\":\"$name\",\"kind\":\"binary\",\"role\":\"main\",\"identifier\":\"com.loadstar.fixture.$name\",\"entitlements\":\"entitlements/app.plist\",\"minOS\":\"$minos\"}"
done

cc "$IN/fat" 14.0 arm64 arm64e -- "$SRC/main.c"
cp "$IN/fat" "$EXP/fat"
sign "$EXP/fat" "com.loadstar.fixture.fat" "$ENT/app.plist"
add_case '{"name":"fat","kind":"binary","role":"main","identifier":"com.loadstar.fixture.fat","entitlements":"entitlements/app.plist","minOS":"14.0"}'

cc "$IN/nosig.dylib" 14.0 arm64 -- -dynamiclib -install_name @rpath/nosig.dylib "$SRC/lib.c"
cp "$IN/nosig.dylib" "$EXP/nosig.dylib"
sign "$EXP/nosig.dylib" "com.loadstar.fixture.nosig" -
add_case '{"name":"nosig.dylib","kind":"binary","role":"dylib","identifier":"com.loadstar.fixture.nosig","entitlements":null,"minOS":"14.0"}'

# re-sign: input already carries an Apple ad-hoc signature with different entitlements
cp "$EXP/thin-min14" "$IN/resign"
cp "$EXP/thin-min14" "$EXP/resign"
sign "$EXP/resign" "com.loadstar.fixture.resign" "$ENT/resign.plist"
add_case '{"name":"resign","kind":"binary","role":"main","identifier":"com.loadstar.fixture.resign","entitlements":"entitlements/resign.plist","minOS":"14.0"}'

# ---------------------------------------------------------------- Test.app bundle
APP="$IN/Test.app"
mkdir -p "$APP/Frameworks/Lib.framework" "$APP/PlugIns/Ext.appex" "$APP/en.lproj" "$APP/Base.lproj" "$APP/Assets/nested"
cc "$APP/Test" 14.0 arm64 -- "$SRC/main.c"
cc "$APP/Frameworks/Lib.framework/Lib" 14.0 arm64 -- -dynamiclib -install_name @rpath/Lib.framework/Lib "$SRC/lib.c"
cc "$APP/Frameworks/libloose.dylib" 14.0 arm64 -- -dynamiclib -install_name @rpath/libloose.dylib "$SRC/lib.c"
cc "$APP/PlugIns/Ext.appex/Ext" 14.0 arm64 -- "$SRC/main.c"
cp "$SRC/bundle/Info.plist" "$APP/Info.plist"
plutil -convert binary1 "$APP/Info.plist" # exercise binary plist parsing
cp "$SRC/bundle/Lib-Info.plist" "$APP/Frameworks/Lib.framework/Info.plist"
cp "$SRC/bundle/Ext-Info.plist" "$APP/PlugIns/Ext.appex/Info.plist"
printf 'APPL????' > "$APP/PkgInfo"
printf '"hello" = "Hello";\n' > "$APP/en.lproj/Localizable.strings"
printf '<?xml version="1.0"?><x/>\n' > "$APP/Base.lproj/Main.storyboardc"
printf 'nested resource\n' > "$APP/Assets/nested/data.bin"
printf 'not a real profile\n' > "$APP/embedded.mobileprovision"
printf 'Finder junk\n' > "$APP/.DS_Store"
ln -s en.lproj/Localizable.strings "$APP/Strings-link"

cp -R "$APP" "$EXP/Test.app"
# bottom-up, exactly as the signer must do it
sign "$EXP/Test.app/Frameworks/Lib.framework" - -
sign "$EXP/Test.app/Frameworks/libloose.dylib" "libloose" -
sign "$EXP/Test.app/PlugIns/Ext.appex" - "$ENT/appex.plist"
sign "$EXP/Test.app" - "$ENT/app.plist"
codesign --verify --deep --strict "$EXP/Test.app"
add_case '{"name":"Test.app","kind":"bundle","role":"main","identifier":"com.loadstar.fixture.app","entitlements":"entitlements/app.plist","minOS":"14.0","nested":[{"path":"Frameworks/Lib.framework","role":"framework","identifier":"com.loadstar.fixture.lib","entitlements":null},{"path":"Frameworks/libloose.dylib","role":"dylib","identifier":"libloose","entitlements":null},{"path":"PlugIns/Ext.appex","role":"appex","identifier":"com.loadstar.fixture.app.ext","entitlements":"entitlements/appex.plist"}]}'

# ---------------------------------------------------------------- manifest
{
  printf '{\n  "codesign": "%s",\n  "iphoneosSdk": "%s",\n  "clang": "%s",\n  "cases": [\n' "$CODESIGN_VERSION" "$SDK_VERSION" "$CLANG_VERSION"
  for i in "${!CASES[@]}"; do
    sep=","; [[ $i -eq $((${#CASES[@]} - 1)) ]] && sep=""
    printf '    %s%s\n' "${CASES[$i]}" "$sep"
  done
  printf '  ]\n}\n'
} > "$OUT/manifest.json"

if [[ $CHECK -eq 1 ]]; then
  # Only signatures matter for drift detection: compare expected/ trees and the manifest.
  if diff -r "$HERE/expected" "$EXP" >/dev/null && diff "$HERE/manifest.json" "$OUT/manifest.json" >/dev/null; then
    log "fixtures up to date"
  else
    log "fixtures differ from a fresh codesign run (toolchain drift?) — run generate.sh and review"
    exit 1
  fi
else
  log "wrote ${#CASES[@]} cases to $OUT"
fi
