#!/usr/bin/env bash
# Stage 4 (optional, costs real money): one longer session that works through
# long-session/tasks.txt one prompt at a time, like a person working with a
# coding agent for an hour. Records each answer and the timings under
# long-session/run/. Nothing leaves the sandbox: no commit, no push.
#
#   DIGITALOCEAN_ACCESS_TOKEN=... DO_INFERENCE_KEY=... scripts/04-long-session.sh
#
# The tokens show up on the month's invoice preview a few hours later; then
# run stage 1 with "preview" and stage 2 on the result.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/long-session/run"
session="long-session-$(date +%s)"
repo="https://github.com/The-DevOps-Daily/do-agent-issue-to-pr"
mkdir -p "$out"
log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$out/timeline.log" >&2; }

cleanup() {
  doctl harness-runtime logs "$session" >"$out/session.log" 2>&1 || true
  log "removing session $session"
  echo y | doctl harness-runtime remove "$session" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "creating session $session"
doctl harness-runtime create --spec "$root/long-session/agent.yaml" --name "$session" --wait-timeout 300 >/dev/null
doctl harness-runtime exec "$session" -- sh -c "git clone -q $repo /workspace/repo && chown -R agent:agent /workspace/repo"

n=0
while IFS= read -r task; do
  [ -n "$task" ] || continue
  n=$((n + 1))
  log "task $n: ${task:0:60}"
  if ! doctl harness-runtime prompt "$session" --on-hitl reject --timeout 1500 -o json - <<<"$task" \
    >"$out/answer-$n.json" 2>"$out/progress-$n.log"; then
    log "task $n did not complete; see $out/progress-$n.log"
  fi
done <"$root/long-session/tasks.txt"

doctl harness-runtime exec "$session" -- sh -c \
  "cd /workspace/repo && git -c safe.directory=/workspace/repo add -A && git -c safe.directory=/workspace/repo diff --cached --stat && python3 -m unittest -q 2>&1 | tail -3" \
  >"$out/result.txt" 2>&1 || true
log "done after $n tasks"
