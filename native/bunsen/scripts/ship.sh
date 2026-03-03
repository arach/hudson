#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ── Signing identity ──────────────────────────────────────────────
export ELECTROBUN_DEVELOPER_ID="Developer ID Application: Arach Tchoupani (2U83JFPW66)"
export ELECTROBUN_TEAMID="2U83JFPW66"

# Uncomment these + set notarize: true in electrobun.config.ts to enable notarization:
# export ELECTROBUN_APPLEID="your@apple.id"
# export ELECTROBUN_APPLEIDPASS="xxxx-xxxx-xxxx-xxxx"  # app-specific password from appleid.apple.com

# ── Read version from config ─────────────────────────────────────
VERSION=$(grep -o '"[0-9]*\.[0-9]*\.[0-9]*"' electrobun.config.ts | tr -d '"')
echo "Building Hudson v${VERSION}"

# ── Optional: bump version ────────────────────────────────────────
if [[ "${1:-}" == "--bump" ]]; then
  MAJOR=$(echo "$VERSION" | cut -d. -f1)
  MINOR=$(echo "$VERSION" | cut -d. -f2)
  PATCH=$(echo "$VERSION" | cut -d. -f3)
  NEW_PATCH=$((PATCH + 1))
  NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

  sed -i '' "s/\"${VERSION}\"/\"${NEW_VERSION}\"/" electrobun.config.ts
  sed -i '' "s/\"version\": \"${VERSION}\"/\"version\": \"${NEW_VERSION}\"/" package.json
  sed -i '' "s/Hudson-${VERSION}/Hudson-${NEW_VERSION}/" scripts/post-package.sh

  VERSION="$NEW_VERSION"
  echo "Bumped to v${VERSION}"
fi

# ── Clean ─────────────────────────────────────────────────────────
echo "Cleaning previous stable build..."
rm -rf build/stable-macos-arm64 artifacts

# ── Build ─────────────────────────────────────────────────────────
echo "Running Vite + Electrobun build..."
bun run build:stable

# ── Verify ────────────────────────────────────────────────────────
DMG="artifacts/Hudson-${VERSION}.dmg"
if [[ ! -f "$DMG" ]]; then
  echo "ERROR: $DMG not found"
  exit 1
fi

echo ""
echo "Verifying code signature..."
codesign -dv build/stable-macos-arm64/Hudson.app 2>&1 | grep -E "Authority|TeamIdentifier|Identifier"
echo ""

SIZE=$(du -h "$DMG" | cut -f1)
echo "✓ ${DMG} (${SIZE})"
echo ""

# ── Open ──────────────────────────────────────────────────────────
if [[ "${1:-}" != "--no-open" && "${2:-}" != "--no-open" ]]; then
  echo "Opening DMG..."
  open "$DMG"
fi
