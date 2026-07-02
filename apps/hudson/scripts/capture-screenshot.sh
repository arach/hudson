#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
OUT_DIR="${1:-$ROOT/screenshots}"
mkdir -p "$OUT_DIR"

APP="${HUDSON_APP_PATH:-$REPO_ROOT/dist/Hudson.app}"
open -a "$APP"
sleep 1.5

WID="$(swift - <<'SWIFT'
import CoreGraphics
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let info = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { exit(1) }
for w in info {
    guard let owner = w[kCGWindowOwnerName as String] as? String, owner == "Hudson" else { continue }
    guard let layer = w[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
    if let num = w[kCGWindowNumber as String] as? Int {
        print(num)
        break
    }
}
SWIFT
)"

STAMP="$(date +%Y%m%d-%H%M%S)"
WINDOW_PATH="$OUT_DIR/canvas-window-$STAMP.png"
FULL_PATH="$OUT_DIR/canvas-display-$STAMP.png"

if [[ -n "$WID" ]]; then
  screencapture -x -o -l "$WID" "$WINDOW_PATH"
  echo "$WINDOW_PATH"
else
  echo "Could not find Hudson window; capturing main display instead." >&2
fi

screencapture -x -m "$FULL_PATH"
echo "$FULL_PATH"
