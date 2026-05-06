#!/usr/bin/env bash
set -euo pipefail

CONTROL_FILE="${HUDSON_VANTAGE_CONTROL_FILE:-/tmp/hudson-vantage-control.jsonl}"
RESPONSE_FILE="${HUDSON_VANTAGE_RESPONSE_FILE:-/tmp/hudson-vantage-control.responses.jsonl}"
REQUEST_ID="vantagectl-$(date +%s)-$$"
WAIT_FOR_RESPONSE=false
WAIT_TIMEOUT=5

usage() {
  cat <<'EOF'
Usage:
  vantagectl.sh [--wait] status
  vantagectl.sh [--wait] reset
  vantagectl.sh [--wait] clear
  vantagectl.sh [--wait] tile COLUMNS ROWS [--width PX] [--height PX] [--gap PX] [--no-reset] [--allow-large]
  vantagectl.sh [--wait] spawn COUNT [--width PX] [--height PX] [--gap PX]
  vantagectl.sh [--wait] reattach [--remote HOST] [--id GRAPHITE_ID] [--session NAME] [--target TARGET] [--create] [--no-reset]
  vantagectl.sh raw '{"action":"status"}'

Environment:
  HUDSON_VANTAGE_CONTROL_FILE   default /tmp/hudson-vantage-control.jsonl
  HUDSON_VANTAGE_RESPONSE_FILE  default /tmp/hudson-vantage-control.responses.jsonl
EOF
}

json_string() {
  local value=${1//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/\\r}
  value=${value//$'\t'/\\t}
  printf '"%s"' "$value"
}

json_array() {
  local first=1
  local item
  printf '['
  for item in "$@"; do
    if [[ $first -eq 0 ]]; then
      printf ','
    fi
    json_string "$item"
    first=0
  done
  printf ']'
}

json_object() {
  local first=1
  local part
  printf '{'
  for part in "$@"; do
    if [[ $first -eq 0 ]]; then
      printf ','
    fi
    printf '%s' "$part"
    first=0
  done
  printf '}'
}

queue_command() {
  local json=$1
  touch "$CONTROL_FILE"
  touch "$RESPONSE_FILE"
  printf '%s\n' "$json" >> "$CONTROL_FILE"

  if [[ "$WAIT_FOR_RESPONSE" == true ]]; then
    local line=""
    SECONDS=0
    while (( SECONDS < WAIT_TIMEOUT )); do
      line=$(grep -F "\"id\":\"$REQUEST_ID\"" "$RESPONSE_FILE" 2>/dev/null | tail -n 1 || true)
      if [[ -n "$line" ]]; then
        printf '%s\n' "$line"
        return 0
      fi
      sleep 0.2
    done
    printf 'queued %s; no response after %ss\n' "$REQUEST_ID" "$WAIT_TIMEOUT"
    return 1
  fi

  printf 'queued %s\ncontrol: %s\nresponses: %s\n' "$REQUEST_ID" "$CONTROL_FILE" "$RESPONSE_FILE"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait)
      WAIT_FOR_RESPONSE=true
      shift
      ;;
    --timeout)
      WAIT_TIMEOUT="${2:?missing timeout}"
      shift 2
      ;;
    --id)
      REQUEST_ID="${2:?missing id}"
      shift 2
      ;;
    --control-file)
      CONTROL_FILE="${2:?missing control file}"
      shift 2
      ;;
    --response-file)
      RESPONSE_FILE="${2:?missing response file}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

command=${1:-}
if [[ -z "$command" ]]; then
  usage
  exit 64
fi
shift || true

case "$command" in
  raw)
    queue_command "${1:?missing raw JSON command}"
    ;;

  status|reset|clear)
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$command")"
    )
    queue_command "$(json_object "${parts[@]}")"
    ;;

  tile|grid)
    columns=${1:-8}
    rows=${2:-8}
    if [[ $# -ge 2 ]]; then
      shift 2
    else
      shift $# || true
    fi
    reset=true
    allow_large=false
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"tile\""
      "\"columns\":$columns"
      "\"rows\":$rows"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --width) parts+=("\"width\":${2:?missing width}"); shift 2 ;;
        --height) parts+=("\"height\":${2:?missing height}"); shift 2 ;;
        --gap) parts+=("\"gap\":${2:?missing gap}"); shift 2 ;;
        --origin-x) parts+=("\"originX\":${2:?missing origin-x}"); shift 2 ;;
        --origin-y) parts+=("\"originY\":${2:?missing origin-y}"); shift 2 ;;
        --no-reset) reset=false; shift ;;
        --allow-large) allow_large=true; shift ;;
        *) printf 'unknown tile option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    parts+=("\"reset\":$reset" "\"allowLarge\":$allow_large")
    queue_command "$(json_object "${parts[@]}")"
    ;;

  spawn|new)
    count=${1:-1}
    if [[ $# -ge 1 ]]; then
      shift
    fi
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"spawn\""
      "\"count\":$count"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --width) parts+=("\"width\":${2:?missing width}"); shift 2 ;;
        --height) parts+=("\"height\":${2:?missing height}"); shift 2 ;;
        --gap) parts+=("\"gap\":${2:?missing gap}"); shift 2 ;;
        --origin-x) parts+=("\"originX\":${2:?missing origin-x}"); shift 2 ;;
        --origin-y) parts+=("\"originY\":${2:?missing origin-y}"); shift 2 ;;
        *) printf 'unknown spawn option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    queue_command "$(json_object "${parts[@]}")"
    ;;

  reattach|attach|tmux)
    ids=()
    sessions=()
    targets=()
    remote=""
    create=false
    reset=true
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"reattach\""
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --id) ids+=("${2:?missing Graphite id}"); shift 2 ;;
        --session) sessions+=("${2:?missing session}"); shift 2 ;;
        --target) targets+=("${2:?missing target}"); shift 2 ;;
        --remote|--remote-host|--ssh) remote="${2:?missing remote host}"; shift 2 ;;
        --create) create=true; shift ;;
        --no-reset) reset=false; shift ;;
        --columns) parts+=("\"columns\":${2:?missing columns}"); shift 2 ;;
        --width) parts+=("\"width\":${2:?missing width}"); shift 2 ;;
        --height) parts+=("\"height\":${2:?missing height}"); shift 2 ;;
        --gap) parts+=("\"gap\":${2:?missing gap}"); shift 2 ;;
        --origin-x) parts+=("\"originX\":${2:?missing origin-x}"); shift 2 ;;
        --origin-y) parts+=("\"originY\":${2:?missing origin-y}"); shift 2 ;;
        *) printf 'unknown reattach option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    if [[ ${#ids[@]} -gt 0 ]]; then
      parts+=("\"ids\":$(json_array "${ids[@]}")")
    fi
    if [[ ${#sessions[@]} -gt 0 ]]; then
      parts+=("\"sessions\":$(json_array "${sessions[@]}")")
    fi
    if [[ ${#targets[@]} -gt 0 ]]; then
      parts+=("\"targets\":$(json_array "${targets[@]}")")
    fi
    if [[ -n "$remote" ]]; then
      parts+=("\"remoteHost\":$(json_string "$remote")")
    fi
    parts+=("\"createIfMissing\":$create" "\"reset\":$reset")
    queue_command "$(json_object "${parts[@]}")"
    ;;

  *)
    printf 'unknown command: %s\n' "$command" >&2
    usage >&2
    exit 64
    ;;
esac
