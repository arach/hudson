#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
app_root="$repo_root/apps/hudson"
package_path="$app_root/native"
main_app_name="Hudson"
main_bundle_name="Hudson"
main_app_path="${HUDSON_APP_PATH:-$repo_root/dist/$main_bundle_name.app}"
menu_app_name="Hudson Menu"
menu_bundle_name="Hudson Menu"
menu_app_path="${HUDSON_MENU_APP_PATH:-$repo_root/dist/$menu_bundle_name.app}"
install_to_applications=false
restart_existing=false

usage() {
  cat <<EOF
Usage: run-app.sh [--install] [--restart]

Builds and launches the native Hudson app plus the Hudson Menu helper.

Options:
  --install   Copy both bundles to ~/Applications after building
  --restart   Quit an existing Hudson/Vantage process before launching

Environment:
  HUDSON_APP_PATH       Override main app path (default: dist/Hudson.app)
  HUDSON_MENU_APP_PATH  Override menu app path (default: dist/Hudson Menu.app)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) install_to_applications=true; shift ;;
    --restart) restart_existing=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 64 ;;
  esac
done

cd "$repo_root"

if [[ ! -f "$app_root/Resources/AppIcon.icns" ]]; then
  echo "Missing $app_root/Resources/AppIcon.icns" >&2
  echo "Regenerate it with: swift $app_root/scripts/generate-app-icon.swift" >&2
  exit 66
fi

HUDSONKIT_WITH_TERMINAL=1 HUDSON_WITH_VOICE_HELPER=1 swift build --package-path "$package_path" -c release --product HudsonApp
HUDSONKIT_WITH_TERMINAL=1 HUDSON_WITH_VOICE_HELPER=1 swift build --package-path "$package_path" -c release --product HudsonMenuApp
bin_dir="$(HUDSONKIT_WITH_TERMINAL=1 HUDSON_WITH_VOICE_HELPER=1 swift build --package-path "$package_path" -c release --show-bin-path)"
main_bin_path="$bin_dir/HudsonApp"
menu_bin_path="$bin_dir/HudsonMenuApp"

copy_swiftpm_bundles() {
  local target_app_path=$1
  find "$bin_dir" -maxdepth 1 -type d -name '*.bundle' -exec sh -c '
    for bundle do
      ditto "$bundle" "$0/$(basename "$bundle")"
    done
  ' "$target_app_path" {} +
}

build_app_bundle() {
  local target_app_path=$1
  local app_name=$2
  local executable_name=$3
  local bundle_id=$4
  local lsui_element=$5
  local binary_path=$6

  rm -rf "$target_app_path"
  mkdir -p "$target_app_path/Contents/MacOS" "$target_app_path/Contents/Resources"
  cp "$binary_path" "$target_app_path/Contents/MacOS/$executable_name"
  chmod +x "$target_app_path/Contents/MacOS/$executable_name"
  cp "$app_root/Resources/AppIcon.icns" "$target_app_path/Contents/Resources/AppIcon.icns"
  copy_swiftpm_bundles "$target_app_path"

  cat > "$target_app_path/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>${executable_name}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>${bundle_id}</string>
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
  <${lsui_element}/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSMicrophoneUsageDescription</key>
  <string>Hudson uses the microphone for local voice commands and transcription through the embedded Vox runtime.</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>NSSupportsAutomaticTermination</key>
  <false/>
</dict>
</plist>
PLIST
}

build_app_bundle "$main_app_path" "$main_app_name" "Hudson" "com.hudsonkit.hudson" "false" "$main_bin_path"
build_app_bundle "$menu_app_path" "$menu_app_name" "HudsonMenu" "com.hudsonkit.hudson.menu" "true" "$menu_bin_path"

if [[ "$restart_existing" == true ]]; then
  pkill -f '[H]udson' 2>/dev/null || true
  pkill -f '[V]antage' 2>/dev/null || true
  pkill -f '[H]udsonApp' 2>/dev/null || true
  pkill -f '[H]udsonMenuApp' 2>/dev/null || true
fi

if [[ "$install_to_applications" == true ]]; then
  main_install_path="$HOME/Applications/$main_bundle_name.app"
  menu_install_path="$HOME/Applications/$menu_bundle_name.app"
  rm -rf "$main_install_path" "$menu_install_path"
  ditto "$main_app_path" "$main_install_path"
  ditto "$menu_app_path" "$menu_install_path"
  main_app_path="$main_install_path"
  menu_app_path="$menu_install_path"
fi

open "$menu_app_path"
open "$main_app_path"

echo "Launched $main_app_path"
echo "Launched $menu_app_path"
