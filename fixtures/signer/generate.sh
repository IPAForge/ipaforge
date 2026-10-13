#!/usr/bin/env bash
# Signer golden fixtures. macOS only (needs Xcode's iOS SDK and Apple `codesign`).
#
#   inputs/        unsigned (or previously signed) binaries and bundles we feed to @loadstar/signer
#   expected/      the same inputs ad-hoc signed by Apple `codesign`, the byte-exact oracle
#   manifest.json  one entry per case + toolchain versions
#
# Usage:
#   fixtures/signer/generate.sh          rebuild inputs/ with clang, sign them into expected/, write manifest
#   fixtures/signer/generate.sh --check  re-sign the COMMITTED inputs with this machine's codesign and fail if the
#                                        result differs from the committed expected/ (detects codesign behaviour
#                                        drift; independent of the clang/SDK version, which changes the inputs)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK=0
[[ "${1:-}" == "--check" ]] && CHECK=1

log() { printf '[fixtures] %s\n' "$*" >&2; }

[[ "$(uname)" == "Darwin" ]] || { log "macOS required"; exit 1; }
CODESIGN_VERSION="$(what /usr/bin/codesign | sed -n 's/.*PROJECT:\(codesign-[0-9.]*\).*/\1/p' | head -1)"
SRC="$HERE/src"
ENT="$HERE/entitlements"

sign() { # sign <path> <identifier|-> <entitlements|-> ; ad-hoc, deterministic
  local path="$1" ident="$2" ent="$3" args=(-f -s - --timestamp=none)
  [[ "$ident" != "-" ]] && args+=(-i "$ident")
  [[ "$ent" != "-" ]] && args+=(--generate-entitlement-der --entitlements "$ent")
  codesign "${args[@]}" "$path" 2>/dev/null
}

# ------------------------------------------------------------------------------------------------ build
build_inputs() { # build_inputs <dir>
  local IN="$1"
  local SDK
  SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
  cc() { # cc <out> <minos> <archs...> -- <extra args...>
    local out="$1" minos="$2"; shift 2
    local archs=()
    while [[ "$1" != "--" ]]; do archs+=(-arch "$1"); shift; done
    shift
    xcrun --sdk iphoneos clang -isysroot "$SDK" "${archs[@]}" -miphoneos-version-min="$minos" \
      -Os -Wl,-headerpad,0x200 "$@" -o "$out"
  }

  rm -rf "$IN" && mkdir -p "$IN"
  for minos in 10.0 14.0 16.0; do cc "$IN/thin-min${minos%%.*}" "$minos" arm64 -- "$SRC/main.c"; done
  cc "$IN/fat" 14.0 arm64 arm64e -- "$SRC/main.c"
  cc "$IN/nosig.dylib" 14.0 arm64 -- -dynamiclib -install_name @rpath/nosig.dylib "$SRC/lib.c"
  # re-sign case: the input already carries an Apple ad-hoc signature (different entitlements)
  cp "$IN/thin-min14" "$IN/resign"
  sign "$IN/resign" "com.loadstar.fixture.thin-min14" "$ENT/app.plist"

  local APP="$IN/Test.app"
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
}

# ------------------------------------------------------------------------------------------------ sign
sign_expected() { # sign_expected <inputs dir> <expected dir>
  local IN="$1" EXP="$2"
  rm -rf "$EXP" && mkdir -p "$EXP"
  for name in thin-min10 thin-min14 thin-min16 fat; do
    cp "$IN/$name" "$EXP/$name"
    sign "$EXP/$name" "com.loadstar.fixture.$name" "$ENT/app.plist"
  done
  cp "$IN/nosig.dylib" "$EXP/nosig.dylib"
  sign "$EXP/nosig.dylib" "com.loadstar.fixture.nosig" -
  cp "$IN/resign" "$EXP/resign"
  sign "$EXP/resign" "com.loadstar.fixture.resign" "$ENT/resign.plist"

  cp -R "$IN/Test.app" "$EXP/Test.app"
  # bottom-up, exactly as the signer must do it
  sign "$EXP/Test.app/Frameworks/Lib.framework" - -
  sign "$EXP/Test.app/Frameworks/libloose.dylib" "libloose" -
  sign "$EXP/Test.app/PlugIns/Ext.appex" - "$ENT/appex.plist"
  sign "$EXP/Test.app" - "$ENT/app.plist"
  codesign --verify --deep --strict "$EXP/Test.app"
}

write_manifest() {
  local sdk clang
  sdk="$(xcrun --sdk iphoneos --show-sdk-version)"
  clang="$(xcrun --sdk iphoneos clang --version | head -1)"
  cat > "$HERE/manifest.json" <<JSON
{
  "codesign": "$CODESIGN_VERSION",
  "iphoneosSdk": "$sdk",
  "clang": "$clang",
  "cases": [
    {"name":"thin-min10","kind":"binary","role":"main","identifier":"com.loadstar.fixture.thin-min10","entitlements":"entitlements/app.plist","minOS":"10.0"},
    {"name":"thin-min14","kind":"binary","role":"main","identifier":"com.loadstar.fixture.thin-min14","entitlements":"entitlements/app.plist","minOS":"14.0"},
    {"name":"thin-min16","kind":"binary","role":"main","identifier":"com.loadstar.fixture.thin-min16","entitlements":"entitlements/app.plist","minOS":"16.0"},
    {"name":"fat","kind":"binary","role":"main","identifier":"com.loadstar.fixture.fat","entitlements":"entitlements/app.plist","minOS":"14.0"},
    {"name":"nosig.dylib","kind":"binary","role":"dylib","identifier":"com.loadstar.fixture.nosig","entitlements":null,"minOS":"14.0"},
    {"name":"resign","kind":"binary","role":"main","identifier":"com.loadstar.fixture.resign","entitlements":"entitlements/resign.plist","minOS":"14.0"},
    {"name":"Test.app","kind":"bundle","role":"main","identifier":"com.loadstar.fixture.app","entitlements":"entitlements/app.plist","minOS":"14.0","symlinks":["Strings-link"],"nested":[{"path":"Frameworks/Lib.framework","role":"framework","identifier":"com.loadstar.fixture.lib","entitlements":null},{"path":"Frameworks/libloose.dylib","role":"dylib","identifier":"libloose","entitlements":null},{"path":"PlugIns/Ext.appex","role":"appex","identifier":"com.loadstar.fixture.app.ext","entitlements":"entitlements/appex.plist"}]}
  ]
}
JSON
}

# ------------------------------------------------------------------------------------------------ main
log "$CODESIGN_VERSION, iOS SDK $(xcrun --sdk iphoneos --show-sdk-version)"
if [[ $CHECK -eq 1 ]]; then
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  sign_expected "$HERE/inputs" "$WORK/expected"
  if diff -r "$HERE/expected" "$WORK/expected" >/dev/null; then
    log "fixtures up to date: this codesign reproduces expected/ from the committed inputs"
  else
    diff -rq "$HERE/expected" "$WORK/expected" | sed 's/^/[fixtures]   /' >&2 || true
    log "codesign behaviour changed — run generate.sh, review the diff, update signer-spec.md if a rule changed"
    exit 1
  fi
else
  build_inputs "$HERE/inputs"
  sign_expected "$HERE/inputs" "$HERE/expected"
  write_manifest
  log "wrote inputs/, expected/ and manifest.json"
fi
