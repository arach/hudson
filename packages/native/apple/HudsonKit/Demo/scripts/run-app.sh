#!/usr/bin/env bash
set -euo pipefail

kit_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
demo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_name="HudsonKit Lab"
bundle_name="HudsonKit Lab"
app_path="${HUDSONKIT_LAB_APP_PATH:-$kit_root/dist/$bundle_name.app}"
install_to_applications=false
restart_existing=false
with_terminal=true
build_config=debug
open_app=true

usage() {
  cat <<EOF
Usage: run-app.sh [--install] [--restart] [--no-terminal] [--release] [--build-only]

Builds and launches HudsonKit Lab as a proper macOS .app (Dock icon, app menu, bundle id).

Options:
  --install      Copy the bundle to ~/Applications after building
  --restart      Quit an existing HudsonKit Lab process before launching
  --no-terminal  Omit HUDSONKIT_WITH_TERMINAL=1 (terminal tab unavailable)
  --release      Release build (slower; default is debug for local iteration)
  --build-only   Build the .app without opening it

Environment:
  HUDSONKIT_LAB_APP_PATH  Override app bundle path (default: dist/HudsonKit Lab.app)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) install_to_applications=true; shift ;;
    --restart) restart_existing=true; shift ;;
    --terminal) with_terminal=true; shift ;;
    --no-terminal) with_terminal=false; shift ;;
    --release) build_config=release; shift ;;
    --build-only) open_app=false; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 64 ;;
  esac
done

icon_path="$demo_root/Resources/AppIcon.icns"
if [[ ! -f "$icon_path" ]]; then
  echo "Missing $icon_path" >&2
  exit 66
fi

cd "$kit_root"

build_env=()
if [[ "$with_terminal" == true ]]; then
  build_env=(env HUDSONKIT_WITH_TERMINAL=1)
fi

"${build_env[@]}" swift build -c "$build_config" --product HudsonKitDemo
bin_dir="$("${build_env[@]}" swift build -c "$build_config" --show-bin-path)"
binary_path="$bin_dir/HudsonKitDemo"

rm -rf "$app_path"
mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
cp "$binary_path" "$app_path/Contents/MacOS/HudsonKitDemo"
chmod +x "$app_path/Contents/MacOS/HudsonKitDemo"
cp "$icon_path" "$app_path/Contents/Resources/AppIcon.icns"

find "$bin_dir" -maxdepth 1 -type d -name '*.bundle' -exec sh -c '
  for bundle do
    ditto "$bundle" "$0/$(basename "$bundle")"
  done
' "$app_path" {} +

cat > "$app_path/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>HudsonKitDemo</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.hudsonkit.lab</string>
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
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

if [[ "$restart_existing" == true ]]; then
  pkill -f '[H]udsonKitDemo' 2>/dev/null || true
  pkill -f '[H]udsonKit Lab' 2>/dev/null || true
fi

if [[ "$install_to_applications" == true ]]; then
  install_path="$HOME/Applications/$bundle_name.app"
  rm -rf "$install_path"
  ditto "$app_path" "$install_path"
  app_path="$install_path"
fi

if [[ "$open_app" == true ]]; then
  open "$app_path"
  echo "Launched $app_path"
else
  echo "Built $app_path"
fi