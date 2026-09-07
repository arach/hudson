#!/bin/zsh
# Launch / resume the Hudson next-gen sidebar OMP session inside Herdr.
# Prefer this over Terminal.app / osascript.
set -euo pipefail

HUDSON="/Users/art/dev/hudson"
OPENSCOUT="/Users/art/dev/openscout"
SESSION_ID="01a02afc"
AGENT_NAME="omp-hudson-sidebar"
SESSION_FILE="$HOME/.omp/agent/sessions/-dev-hudson/2026-08-22T19-40-09-736Z_01a02afc-dc88-7000-b90b-92e40a65b53b.jsonl"

# Ensure Herdr is reachable
if ! herdr status >/dev/null 2>&1; then
  echo "error: Herdr is not running / not reachable" >&2
  exit 1
fi

# Reuse existing named agent if present
EXISTING="$(herdr agent list 2>/dev/null | node -e '
let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
  try {
    const j=JSON.parse(d);
    const agents=j?.result?.agents||[];
    const hit=agents.find(a=>a.name==="'"$AGENT_NAME"'" || (a.agent==="omp" && String(a.cwd||"").includes("/hudson")));
    if (hit) console.log(hit.pane_id+"\t"+hit.name);
  } catch {}
});
' || true)"

if [[ -n "${EXISTING:-}" ]]; then
  PANE_ID="${EXISTING%%$'\t'*}"
  echo "Reusing Herdr agent $AGENT_NAME on $PANE_ID"
  herdr agent focus "$AGENT_NAME" 2>/dev/null || herdr pane focus --pane "$PANE_ID" 2>/dev/null || true
  herdr agent prompt "$AGENT_NAME" "Continue next-gen sidebar work. Stay in auto-approve/yolo." --wait --timeout 60000 || true
  exit 0
fi

# Create a sibling pane in the focused tab, cwd=hudson
SPLIT_JSON="$(herdr pane split --current --direction right --cwd "$HUDSON" --no-focus)"
PANE_ID="$(printf '%s' "$SPLIT_JSON" | node -e '
let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
  const j=JSON.parse(d);
  const id=j?.result?.pane?.pane_id;
  if (!id) { console.error("no pane id from split:", d); process.exit(1); }
  console.log(id);
});
')"

echo "Started shell pane $PANE_ID — launching OMP"

OMP_ARGS=(
  --cwd "$HUDSON"
  --add-dir "$OPENSCOUT"
  --model openai-codex/gpt-5.6-sol
  --thinking xhigh
  --auto-approve
  --approval-mode yolo
)

if [[ -f "$SESSION_FILE" ]]; then
  herdr agent start "$AGENT_NAME" --kind omp --pane "$PANE_ID" --timeout 60000 -- \
    -r "$SESSION_ID" "${OMP_ARGS[@]}"
  herdr agent prompt "$AGENT_NAME" "Continue. Approval is auto-approve (yolo). Keep going on the next-gen sidebar contribution." --wait --timeout 120000
else
  herdr agent start "$AGENT_NAME" --kind omp --pane "$PANE_ID" --timeout 60000 -- \
    "${OMP_ARGS[@]}" \
    @docs/eng/next-gen-sidebar-handoff.md
  herdr agent prompt "$AGENT_NAME" "Take ownership of the next-gen sidebar contribution into Hudson. Read the attached handoff first, then produce the gap matrix and start implementing." --wait --timeout 120000
fi
