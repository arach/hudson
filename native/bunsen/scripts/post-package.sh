#!/bin/bash
# Copy the DMG with a clean distributable name
# Read version from electrobun.config.ts (bun shell runs this, so keep it simple)
cp artifacts/stable-macos-arm64-Hudson.dmg artifacts/Hudson-0.0.7.dmg 2>/dev/null
cp artifacts/stable-macos-arm64-Hudson.app.tar.zst artifacts/Hudson-0.0.7.app.tar.zst 2>/dev/null || true
