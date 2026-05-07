#!/usr/bin/env bash
set -euo pipefail

CONTROL_FILE="${HUDSON_VANTAGE_CONTROL_FILE:-/tmp/hudson-vantage-control.jsonl}"
RESPONSE_FILE="${HUDSON_VANTAGE_RESPONSE_FILE:-/tmp/hudson-vantage-control.responses.jsonl}"
STATE_FILE="${HUDSON_VANTAGE_STATE_FILE:-/tmp/hudson-vantage-state.json}"
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
  vantagectl.sh [--wait] select NODE... [--add|--remove|--toggle|--clear]
  vantagectl.sh [--wait] inspect [NODE...]
  vantagectl.sh [--wait] focus [NODE...]
  vantagectl.sh [--wait] focus-mode [NODE]
  vantagectl.sh [--wait] exit-focus
  vantagectl.sh [--wait] popout [NODE...]
  vantagectl.sh [--wait] close [NODE...]
  vantagectl.sh [--wait] metrics [--reset]
  vantagectl.sh [--wait] perf-harness [--prefix PREFIX] [--sessions N] [--active N] [--mode tail|idle] [--rate-ms N] [--columns N] [--width PX] [--height PX] [--gap PX] [--no-reset]
  vantagectl.sh [--wait] perf-cleanup [--prefix PREFIX]
  vantagectl.sh [--wait] viewport [--reset|--fit] [--pan-x PX --pan-y PX --scale N]
  vantagectl.sh [--wait] ensure-tmux [--confirm]
  vantagectl.sh [--wait] save [--state-file PATH]
  vantagectl.sh [--wait] save-workspace [--state-file PATH]
  vantagectl.sh [--wait] restore [--state-file PATH] [--create] [--no-reset]
  vantagectl.sh [--wait] restore-workspace [--state-file PATH] [--create] [--no-reset]
  vantagectl.sh raw '{"action":"status"}'

Environment:
  HUDSON_VANTAGE_CONTROL_FILE   default /tmp/hudson-vantage-control.jsonl
  HUDSON_VANTAGE_RESPONSE_FILE  default /tmp/hudson-vantage-control.responses.jsonl
  HUDSON_VANTAGE_STATE_FILE     default /tmp/hudson-vantage-state.json
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

normalize_raw_command() {
  local raw_json=$1
  local tmp_file
  local raw_id
  tmp_file=$(mktemp "${TMPDIR:-/tmp}/vantagectl.raw.XXXXXX")
  trap 'rm -f "$tmp_file"' RETURN

  printf '%s' "$raw_json" > "$tmp_file"
  if ! plutil -convert json -r -o "$tmp_file" "$tmp_file" >/dev/null 2>&1; then
    printf 'invalid raw command: expected JSON object\n' >&2
    exit 64
  fi

  if raw_id=$(plutil -extract id raw -o - "$tmp_file" 2>/dev/null); then
    REQUEST_ID="$raw_id"
  elif ! plutil -insert id -string "$REQUEST_ID" "$tmp_file" >/dev/null 2>&1; then
    printf 'invalid raw command: expected JSON object\n' >&2
    exit 64
  fi

  if ! plutil -extract apiVersion raw -o - "$tmp_file" >/dev/null 2>&1 \
    && ! plutil -extract version raw -o - "$tmp_file" >/dev/null 2>&1; then
    plutil -insert apiVersion -string v0 "$tmp_file" >/dev/null
  fi

  if ! plutil -extract kind raw -o - "$tmp_file" >/dev/null 2>&1; then
    plutil -insert kind -string hudson.vantage.command "$tmp_file" >/dev/null
  fi

  RAW_COMMAND_JSON=$(plutil -convert json -r -o - "$tmp_file" | tr -d '\n')
}

json_int_arg() {
  local name=$1
  local value=$2
  if [[ ! "$value" =~ ^-?(0|[1-9][0-9]*)$ ]]; then
    printf 'invalid %s: expected JSON integer, got %s\n' "$name" "$value" >&2
    exit 64
  fi
  printf '%s' "$value"
}

json_number_arg() {
  local name=$1
  local value=$2
  if [[ ! "$value" =~ ^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$ ]]; then
    printf 'invalid %s: expected JSON number, got %s\n' "$name" "$value" >&2
    exit 64
  fi
  printf '%s' "$value"
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
    --state-file)
      STATE_FILE="${2:?missing state file}"
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
    normalize_raw_command "${1:?missing raw JSON command}"
    queue_command "$RAW_COMMAND_JSON"
    ;;

  status|reset|clear)
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$command")"
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
    )
    queue_command "$(json_object "${parts[@]}")"
    ;;

  metrics|perf)
    action="metrics"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --reset) action="perf-reset"; shift ;;
        *) printf 'unknown metrics option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$action")"
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"includeMetrics\":true"
      "\"includeViewport\":true"
    )
    queue_command "$(json_object "${parts[@]}")"
    ;;

  perf-harness|harness|stress)
    count=64
    active=32
    mode="tail"
    reset=true
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"perf-harness\""
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"includeMetrics\":true"
      "\"includeViewport\":true"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --prefix) parts+=("\"prefix\":$(json_string "${2:?missing prefix}")"); shift 2 ;;
        --sessions|--count) count="${2:?missing sessions}"; shift 2 ;;
        --active) active="${2:?missing active count}"; shift 2 ;;
        --mode) mode="${2:?missing mode}"; shift 2 ;;
        --rate-ms) parts+=("\"rateMS\":$(json_number_arg rate-ms "${2:?missing rate-ms}")"); shift 2 ;;
        --columns) parts+=("\"columns\":$(json_int_arg columns "${2:?missing columns}")"); shift 2 ;;
        --width) parts+=("\"width\":$(json_number_arg width "${2:?missing width}")"); shift 2 ;;
        --height) parts+=("\"height\":$(json_number_arg height "${2:?missing height}")"); shift 2 ;;
        --gap) parts+=("\"gap\":$(json_number_arg gap "${2:?missing gap}")"); shift 2 ;;
        --origin-x) parts+=("\"originX\":$(json_number_arg origin-x "${2:?missing origin-x}")"); shift 2 ;;
        --origin-y) parts+=("\"originY\":$(json_number_arg origin-y "${2:?missing origin-y}")"); shift 2 ;;
        --no-reset) reset=false; shift ;;
        *) printf 'unknown perf-harness option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    parts+=(
      "\"count\":$(json_int_arg sessions "$count")"
      "\"activeCount\":$(json_int_arg active "$active")"
      "\"harnessMode\":$(json_string "$mode")"
      "\"reset\":$reset"
    )
    queue_command "$(json_object "${parts[@]}")"
    ;;

  perf-cleanup|harness-cleanup|stress-cleanup)
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"perf-cleanup\""
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"includeMetrics\":true"
      "\"includeViewport\":true"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --prefix) parts+=("\"prefix\":$(json_string "${2:?missing prefix}")"); shift 2 ;;
        *) printf 'unknown perf-cleanup option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    queue_command "$(json_object "${parts[@]}")"
    ;;

  viewport|view)
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"viewport\""
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"includeViewport\":true"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --reset) parts+=("\"reset\":true"); shift ;;
        --fit) parts+=("\"fit\":true"); shift ;;
        --pan-x) parts+=("\"panX\":$(json_number_arg pan-x "${2:?missing pan-x}")"); shift 2 ;;
        --pan-y) parts+=("\"panY\":$(json_number_arg pan-y "${2:?missing pan-y}")"); shift 2 ;;
        --scale) parts+=("\"scale\":$(json_number_arg scale "${2:?missing scale}")"); shift 2 ;;
        *) printf 'unknown viewport option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    queue_command "$(json_object "${parts[@]}")"
    ;;

  select)
    mode="replace"
    node_ids=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --add) mode="add"; shift ;;
        --remove|--subtract) mode="remove"; shift ;;
        --toggle) mode="toggle"; shift ;;
        --clear) mode="clear"; shift ;;
        --node|--node-id) node_ids+=("${2:?missing node id}"); shift 2 ;;
        *) node_ids+=("$1"); shift ;;
      esac
    done
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"select\""
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"selectionMode\":$(json_string "$mode")"
    )
    if [[ ${#node_ids[@]} -gt 0 ]]; then
      parts+=("\"nodeIDs\":$(json_array "${node_ids[@]}")")
    fi
    queue_command "$(json_object "${parts[@]}")"
    ;;

  inspect|focus|center|reveal|close|remove)
    node_ids=()
    action="$command"
    case "$command" in
      center|reveal) action="focus" ;;
      remove) action="close" ;;
    esac
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --node|--node-id) node_ids+=("${2:?missing node id}"); shift 2 ;;
        *) node_ids+=("$1"); shift ;;
      esac
    done
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$action")"
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
    )
    if [[ ${#node_ids[@]} -gt 0 ]]; then
      parts+=("\"nodeIDs\":$(json_array "${node_ids[@]}")")
    fi
    queue_command "$(json_object "${parts[@]}")"
    ;;

  focus-mode|focusmode|enter-focus|enterfocus|solo|popout|pop-out|pop-window|popwindow)
    node_ids=()
    action="$command"
    case "$command" in
      focusmode|enter-focus|enterfocus|solo) action="focus-mode" ;;
      pop-out|pop-window|popwindow) action="popout" ;;
    esac
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --node|--node-id) node_ids+=("${2:?missing node id}"); shift 2 ;;
        *) node_ids+=("$1"); shift ;;
      esac
    done
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$action")"
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
    )
    if [[ ${#node_ids[@]} -gt 0 ]]; then
      parts+=("\"nodeIDs\":$(json_array "${node_ids[@]}")")
    fi
    queue_command "$(json_object "${parts[@]}")"
    ;;

  exit-focus|exitfocus|leave-focus|leavefocus|unfocus)
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"exit-focus\""
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
    )
    queue_command "$(json_object "${parts[@]}")"
    ;;

  save|snapshot|save-workspace|workspace-save|export-workspace)
    action="$command"
    case "$command" in
      snapshot) action="save" ;;
      workspace-save|export-workspace) action="save-workspace" ;;
    esac
    state_path="$STATE_FILE"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --state-file) state_path="${2:?missing state file}"; shift 2 ;;
        *) printf 'unknown save option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$action")"
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"statePath\":$(json_string "$state_path")"
    )
    queue_command "$(json_object "${parts[@]}")"
    ;;

  ensure-tmux|ensuretmux|tmux-ensure|install-tmux|installtmux|tmux-install)
    confirm=false
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":\"ensure-tmux\""
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"installer\":\"homebrew\""
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --confirm) confirm=true; shift ;;
        *) printf 'unknown ensure-tmux option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    parts+=("\"confirmInstall\":$confirm")
    queue_command "$(json_object "${parts[@]}")"
    ;;

  restore|load|restore-workspace|workspace-restore|open-workspace|import-workspace)
    action="$command"
    case "$command" in
      load) action="restore" ;;
      workspace-restore|open-workspace|import-workspace) action="restore-workspace" ;;
    esac
    create=false
    reset=true
    state_path="$STATE_FILE"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --state-file) state_path="${2:?missing state file}"; shift 2 ;;
        --create) create=true; shift ;;
        --no-reset) reset=false; shift ;;
        *) printf 'unknown restore option: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    parts=(
      "\"id\":$(json_string "$REQUEST_ID")"
      "\"action\":$(json_string "$action")"
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"statePath\":$(json_string "$state_path")"
    )
    parts+=("\"createIfMissing\":$create" "\"reset\":$reset")
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
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"columns\":$(json_int_arg columns "$columns")"
      "\"rows\":$(json_int_arg rows "$rows")"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --width) parts+=("\"width\":$(json_number_arg width "${2:?missing width}")"); shift 2 ;;
        --height) parts+=("\"height\":$(json_number_arg height "${2:?missing height}")"); shift 2 ;;
        --gap) parts+=("\"gap\":$(json_number_arg gap "${2:?missing gap}")"); shift 2 ;;
        --origin-x) parts+=("\"originX\":$(json_number_arg origin-x "${2:?missing origin-x}")"); shift 2 ;;
        --origin-y) parts+=("\"originY\":$(json_number_arg origin-y "${2:?missing origin-y}")"); shift 2 ;;
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
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
      "\"count\":$(json_int_arg count "$count")"
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --width) parts+=("\"width\":$(json_number_arg width "${2:?missing width}")"); shift 2 ;;
        --height) parts+=("\"height\":$(json_number_arg height "${2:?missing height}")"); shift 2 ;;
        --gap) parts+=("\"gap\":$(json_number_arg gap "${2:?missing gap}")"); shift 2 ;;
        --origin-x) parts+=("\"originX\":$(json_number_arg origin-x "${2:?missing origin-x}")"); shift 2 ;;
        --origin-y) parts+=("\"originY\":$(json_number_arg origin-y "${2:?missing origin-y}")"); shift 2 ;;
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
      "\"apiVersion\":\"v0\""
      "\"kind\":\"hudson.vantage.command\""
    )
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --id) ids+=("${2:?missing Graphite id}"); shift 2 ;;
        --session) sessions+=("${2:?missing session}"); shift 2 ;;
        --target) targets+=("${2:?missing target}"); shift 2 ;;
        --remote|--remote-host|--ssh) remote="${2:?missing remote host}"; shift 2 ;;
        --create) create=true; shift ;;
        --no-reset) reset=false; shift ;;
        --columns) parts+=("\"columns\":$(json_int_arg columns "${2:?missing columns}")"); shift 2 ;;
        --width) parts+=("\"width\":$(json_number_arg width "${2:?missing width}")"); shift 2 ;;
        --height) parts+=("\"height\":$(json_number_arg height "${2:?missing height}")"); shift 2 ;;
        --gap) parts+=("\"gap\":$(json_number_arg gap "${2:?missing gap}")"); shift 2 ;;
        --origin-x) parts+=("\"originX\":$(json_number_arg origin-x "${2:?missing origin-x}")"); shift 2 ;;
        --origin-y) parts+=("\"originY\":$(json_number_arg origin-y "${2:?missing origin-y}")"); shift 2 ;;
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
