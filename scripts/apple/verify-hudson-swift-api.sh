#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<'EOF'
Usage: verify-hudson-swift-api.sh [--root PATH] [--product NAME] [--symbol NAME ...]

Fail fast when a Hudson checkout does not expose Swift API required by a
consumer before Xcode/SwiftPM reaches a less helpful "cannot find type" error.

Examples:
  scripts/apple/verify-hudson-swift-api.sh \
    --product HudsonUI \
    --symbol HudAgentReplySpeechController \
    --symbol HudAgentReplySpeechReply

Environment:
  HUDSON_SWIFT_API_ROOT       Hudson checkout root when --root is omitted.
  HUDSON_REQUIRED_PRODUCT     Product to require when --product is omitted.
  HUDSON_REQUIRED_SYMBOLS     Space-separated symbols when --symbol is omitted.
EOF
}

ROOT="${HUDSON_SWIFT_API_ROOT:-}"
PRODUCT="${HUDSON_REQUIRED_PRODUCT:-HudsonUI}"
SYMBOLS=()

if [ -n "${HUDSON_REQUIRED_SYMBOLS:-}" ]; then
    # shellcheck disable=SC2206
    SYMBOLS=(${HUDSON_REQUIRED_SYMBOLS})
fi

while [ $# -gt 0 ]; do
    case "$1" in
        --root)
            [ $# -ge 2 ] || { echo "Missing value for --root" >&2; exit 2; }
            ROOT="$2"
            shift 2
            ;;
        --product)
            [ $# -ge 2 ] || { echo "Missing value for --product" >&2; exit 2; }
            PRODUCT="$2"
            shift 2
            ;;
        --symbol)
            [ $# -ge 2 ] || { echo "Missing value for --symbol" >&2; exit 2; }
            SYMBOLS+=("$2")
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [ -z "$ROOT" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

if [ "${#SYMBOLS[@]}" -eq 0 ]; then
    SYMBOLS=(
        HudAgentReplySpeechController
        HudAgentReplySpeechReply
        HudAgentReplySpeechRequest
        HudAgentReplySpeechSynthesizer
        HudAgentReplySpeechAudio
    )
fi

if [ ! -f "$ROOT/Package.swift" ]; then
    echo "Hudson Swift API check failed: Package.swift not found at $ROOT" >&2
    exit 1
fi

SOURCE_ROOT="$ROOT/packages/native/apple/HudsonKit/Sources"
if [ ! -d "$SOURCE_ROOT" ]; then
    echo "Hudson Swift API check failed: source root not found at $SOURCE_ROOT" >&2
    exit 1
fi

if ! grep -Eq "name:[[:space:]]*\"$PRODUCT\"" "$ROOT/Package.swift"; then
    echo "Hudson Swift API check failed: Package.swift does not declare product '$PRODUCT'." >&2
    exit 1
fi

ref="unknown"
branch=""
dirty=""
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ref="$(git -C "$ROOT" rev-parse --short=12 HEAD 2>/dev/null || printf unknown)"
    branch="$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
    if [ -n "$(git -C "$ROOT" status --porcelain=v1 2>/dev/null || true)" ]; then
        dirty=" dirty"
    fi
fi

missing=()
for symbol in "${SYMBOLS[@]}"; do
    if ! grep -R -E "\\b${symbol}\\b" "$SOURCE_ROOT" --include '*.swift' >/dev/null; then
        missing+=("$symbol")
    fi
done

if [ "${#missing[@]}" -gt 0 ]; then
    {
        echo "Hudson Swift API check failed for $ROOT"
        echo "Required product: $PRODUCT"
        echo "Checkout: ${branch:+$branch @ }$ref$dirty"
        echo "Missing symbols:"
        for symbol in "${missing[@]}"; do
            echo "  - $symbol"
        done
        echo
        echo "Resolve by switching the selected Hudson checkout to a compatible branch/revision,"
        echo "or pinning the consumer to a Git ref that contains these API symbols."
    } >&2
    exit 1
fi

echo "Hudson Swift API check passed: $PRODUCT exposes ${SYMBOLS[*]} (${branch:+$branch @ }$ref$dirty)"
