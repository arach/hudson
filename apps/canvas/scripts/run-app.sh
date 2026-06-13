#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
package_path="$repo_root/apps/canvas"
app_name="Canvas"
bundle_name="Hudson Canvas"
app_path="${HUDSON_CANVAS_APP_PATH:-$repo_root/dist/$bundle_name.app}"
install_to_applications=false
restart_existing=false
configuration=release
skip_icon=false

usage() {
  cat <<EOF
Usage: run-app.sh [--install] [--restart] [--debug] [--skip-icon]

Builds the native Hudson Canvas macOS app bundle and launches it.

Options:
  --install   Copy the bundle to ~/Applications after building
  --restart   Quit an existing Canvas process before launching
  --debug     Build and bundle the debug executable for faster iteration
  --skip-icon Reuse the existing app icon instead of regenerating it

Environment:
  HUDSON_CANVAS_APP_PATH  Override output .app path (default: dist/Hudson Canvas.app)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) install_to_applications=true; shift ;;
    --restart) restart_existing=true; shift ;;
    --debug) configuration=debug; shift ;;
    --skip-icon) skip_icon=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 64 ;;
  esac
done

cd "$repo_root"

if [[ "$skip_icon" != true || ! -f "$package_path/Resources/AppIcon.icns" ]]; then
  swift "$package_path/scripts/generate-app-icon.swift"
fi

swift_args=(--package-path "$package_path")
if [[ "$configuration" == "release" ]]; then
  swift_args+=(-c release)
fi

HUDSONKIT_WITH_TERMINAL=1 swift build "${swift_args[@]}" --product CanvasApp
bin_path="$(HUDSONKIT_WITH_TERMINAL=1 swift build "${swift_args[@]}" --show-bin-path)/CanvasApp"

rm -rf "$app_path"
mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
cp "$bin_path" "$app_path/Contents/MacOS/Canvas"
chmod +x "$app_path/Contents/MacOS/Canvas"
cp "$package_path/Resources/AppIcon.icns" "$app_path/Contents/Resources/AppIcon.icns"
for resource_bundle in "$(dirname "$bin_path")"/*.bundle; do
  [[ -e "$resource_bundle" ]] || continue
  name="$(basename "$resource_bundle")"
  ditto "$resource_bundle" "$app_path/$name"
  ditto "$resource_bundle" "$app_path/Contents/Resources/$name"
  ditto "$resource_bundle" "$app_path/Contents/MacOS/$name"
done

cat > "$app_path/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>Canvas</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.hudsonkit.canvas</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${app_name}</string>
  <key>CFBundleDisplayName</key>
  <string>${app_name}</string>
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

if [[ "$restart_existing" == true ]]; then
  pkill -f '[C]anvas' 2>/dev/null || true
  pkill -f '[T]erminiCanvas' 2>/dev/null || true
fi

if [[ "$install_to_applications" == true ]]; then
  install_path="$HOME/Applications/$bundle_name.app"
  rm -rf "$install_path"
  ditto "$app_path" "$install_path"
  app_path="$install_path"
fi

open -n "$app_path"

echo "Launched $app_path ($configuration)"
