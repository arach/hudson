#!/bin/bash
# Copy the DMG with a clean distributable name
VERSION="${npm_package_version:-0.0.1}"
for f in artifacts/*-Hudson.dmg; do
  [ -f "$f" ] && cp "$f" "artifacts/Hudson-${VERSION}.dmg"
done
