#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

measure_app() {
  local name="$1"
  local binary="$2"

  pkill -x "$name" 2>/dev/null || true
  sleep 1

  open -n "$binary"
  local pid=""
  for _ in 1 2 3 4 5; do
    sleep 1
    pid="$(pgrep -n "$name" || true)"
    [[ -n "$pid" ]] && break
  done

  sleep 5
  pid="$(pgrep -n "$name" || true)"
  echo "=== $name ==="
  if [[ -z "$pid" ]]; then
    echo "not running"
    return
  fi

  ps -o pid,rss,vsz,comm -p "$pid"
  vmmap -summary "$pid" | sed -n '/Physical footprint/,+2p'
  pkill -x "$name" 2>/dev/null || true
}

swift build -c release --product HudsonKitAppKitReference
swift build -c release --product HudsonKitShellReference
swift build -c release --product HudsonKitReference

measure_app "HudsonKitAppKitReference" "$ROOT/.build/release/HudsonKitAppKitReference"
measure_app "HudsonKitShellReference" "$ROOT/.build/release/HudsonKitShellReference"
measure_app "HudsonKitReference" "$ROOT/.build/release/HudsonKitReference"

du -sh \
  "$ROOT/.build/release/HudsonKitAppKitReference" \
  "$ROOT/.build/release/HudsonKitShellReference" \
  "$ROOT/.build/release/HudsonKitReference"
