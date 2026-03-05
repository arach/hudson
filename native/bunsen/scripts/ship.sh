#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ── Signing identity ──────────────────────────────────────────────
export ELECTROBUN_DEVELOPER_ID="Developer ID Application: Arach Tchoupani (2U83JFPW66)"
NOTARY_PROFILE="notarytool"

# ── Read version from config ─────────────────────────────────────
VERSION=$(grep -o '"[0-9]*\.[0-9]*\.[0-9]*"' electrobun.config.ts | tr -d '"')
echo "═══════════════════════════════════════════"
echo "  Hudson v${VERSION}"
echo "═══════════════════════════════════════════"

# ── Parse flags ───────────────────────────────────────────────────
BUMP=false
NO_OPEN=false
SKIP_NOTARIZE=false
for arg in "$@"; do
  case "$arg" in
    --bump)          BUMP=true ;;
    --no-open)       NO_OPEN=true ;;
    --skip-notarize) SKIP_NOTARIZE=true ;;
  esac
done

# ── Optional: bump version ────────────────────────────────────────
if $BUMP; then
  MAJOR=$(echo "$VERSION" | cut -d. -f1)
  MINOR=$(echo "$VERSION" | cut -d. -f2)
  PATCH=$(echo "$VERSION" | cut -d. -f3)
  NEW_PATCH=$((PATCH + 1))
  NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

  sed -i '' "s/\"${VERSION}\"/\"${NEW_VERSION}\"/" electrobun.config.ts
  sed -i '' "s/\"version\": \"${VERSION}\"/\"version\": \"${NEW_VERSION}\"/" package.json
  sed -i '' "s/Hudson-${VERSION}/Hudson-${NEW_VERSION}/" scripts/post-package.sh

  VERSION="$NEW_VERSION"
  echo "  → Bumped to v${VERSION}"
fi

# ── Clean ─────────────────────────────────────────────────────────
echo ""
echo "▸ Cleaning previous stable build..."
rm -rf build/stable-macos-arm64 artifacts

# ── Build ─────────────────────────────────────────────────────────
echo "▸ Building (Vite + Electrobun)..."
bun run build:stable

DMG="artifacts/Hudson-${VERSION}.dmg"
APP="build/stable-macos-arm64/Hudson.app"

if [[ ! -f "$DMG" ]]; then
  echo "ERROR: $DMG not found"
  exit 1
fi

# ── Verify signature ─────────────────────────────────────────────
echo ""
echo "▸ Verifying code signature..."
codesign --verify --deep --strict "$APP" 2>&1
codesign -dv "$APP" 2>&1 | grep -E "Authority|TeamIdentifier"

# ── Notarize ──────────────────────────────────────────────────────
if $SKIP_NOTARIZE; then
  echo ""
  echo "▸ Skipping notarization (--skip-notarize)"
else
  echo ""
  echo "▸ Submitting DMG for notarization..."
  xcrun notarytool submit "$DMG" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait

  echo ""
  echo "▸ Stapling notarization ticket..."
  xcrun stapler staple "$DMG"

  echo ""
  echo "▸ Gatekeeper check..."
  spctl --assess --verbose=2 --type open --context context:primary-signature "$DMG" 2>&1 || true
fi

# ── Upload to GitHub ──────────────────────────────────────────────
echo ""
echo "▸ Creating GitHub release v${VERSION}..."
gh release create "v${VERSION}" \
  --repo arach/hudsonos \
  --title "Hudson v${VERSION}" \
  --notes "Hudson v${VERSION}" \
  "$DMG"

# ── Summary ───────────────────────────────────────────────────────
SIZE=$(du -h "$DMG" | cut -f1)
echo ""
echo "═══════════════════════════════════════════"
echo "  ✓ ${DMG} (${SIZE})"
echo "  ✓ https://github.com/arach/hudsonos/releases/tag/v${VERSION}"
echo "═══════════════════════════════════════════"

# ── Open ──────────────────────────────────────────────────────────
if ! $NO_OPEN; then
  open "$DMG"
fi
