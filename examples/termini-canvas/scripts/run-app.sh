#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
package_path="$repo_root/examples/termini-canvas"
app_path="${TERMINI_CANVAS_APP_PATH:-/tmp/TerminiCanvas.app}"

cd "$repo_root"

HUDSONKIT_WITH_TERMINAL=1 swift build --package-path "$package_path"
bin_path="$(HUDSONKIT_WITH_TERMINAL=1 swift build --package-path "$package_path" --show-bin-path)/TerminiCanvas"

rm -rf "$app_path"
mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
cp "$bin_path" "$app_path/Contents/MacOS/TerminiCanvas"
chmod +x "$app_path/Contents/MacOS/TerminiCanvas"

cat > "$app_path/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>TerminiCanvas</string>
  <key>CFBundleIdentifier</key>
  <string>dev.arach.hudson.terminicanvas</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Termini Canvas</string>
  <key>CFBundleDisplayName</key>
  <string>Termini Canvas</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>LSUIElement</key>
  <false/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

pkill -f '[T]erminiCanvas' 2>/dev/null || true
rm -f /tmp/termini-canvas-control.jsonl /tmp/termini-canvas-control.responses.jsonl
open -n "$app_path"

echo "Launched $app_path"
