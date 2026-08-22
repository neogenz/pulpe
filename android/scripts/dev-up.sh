#!/usr/bin/env bash
#
# Brings up everything the Android app needs, on ports that belong to this
# worktree alone.
#
# The isolation is one-sided on purpose. The device keeps asking for the
# default ports — 3000 for the API, 8081 for the bundle — and `adb reverse`
# lands those on this worktree's own host ports instead:
#
#     device 3000  ->  host 3100   this worktree's backend
#     device 8081  ->  host 8181   this worktree's Metro
#     device 54321 ->  host 54321  the machine's one Supabase stack
#
# So `android/.env` stays exactly what a plain checkout expects, no default
# port is squatted, and another Pulpe backend running on 3000 can no longer be
# reached from the emulator by accident.
#
# Nothing here kills a process it does not own: every stop is guarded by the
# process's working directory.

set -euo pipefail

WORKTREE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_PORT=3100
METRO_PORT=8181
SUPABASE_PORT=54321
LOG_DIR="${TMPDIR:-/tmp}/pulpe-android-dev"

mkdir -p "$LOG_DIR"

say() { printf '%s\n' "$*"; }

# Only stops a listener whose working directory is inside this worktree —
# a sibling checkout's server on the same port is left strictly alone.
stop_if_ours() {
  local port=$1 label=$2 pid cwd
  pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1) || true
  [ -n "${pid:-}" ] || return 0

  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | tail -1 | sed 's/^n//')
  case "$cwd" in
    "$WORKTREE"*) kill "$pid" 2>/dev/null || true; say "  stopped previous $label (pid $pid)" ;;
    *) say "  !! port $port held by $cwd — not ours, leaving it"; return 1 ;;
  esac
}

wait_for() {
  local url=$1 label=$2 tries=0
  until curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then say "  !! $label never answered $url"; return 1; fi
    sleep 2
  done
}

say "Supabase"
if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${SUPABASE_PORT}/auth/v1/health"; then
  say "  up on $SUPABASE_PORT (shared: one stack per machine)"
else
  say "  !! not reachable on $SUPABASE_PORT."
  say "     Start it from the MAIN repo, not a worktree — kong mounts host paths:"
  say "     cd ~/workspace/perso/_projets/pulpe-workspace/backend-nest && supabase start"
  exit 1
fi

say "Backend  -> host $BACKEND_PORT"
stop_if_ours "$BACKEND_PORT" "backend"
# Not `bun run dev`: that script starts Supabase first, and starting it from a
# worktree breaks kong's host mounts. Supabase is checked above instead.
# `.env.local` pins PORT=3000; a shell variable beats the env file in Bun,
# which is what keeps this worktree off the default port.
(cd "$WORKTREE/backend-nest" &&
  NODE_ENV=development PORT="$BACKEND_PORT" \
    bun --env-file=.env.local --watch src/main.ts) \
  >"$LOG_DIR/backend.log" 2>&1 &
wait_for "http://127.0.0.1:${BACKEND_PORT}/health" "backend"
say "  healthy  (log: $LOG_DIR/backend.log)"

say "Metro    -> host $METRO_PORT"
stop_if_ours "$METRO_PORT" "Metro"
(cd "$WORKTREE/android" && pnpm exec expo start --port "$METRO_PORT") \
  >"$LOG_DIR/metro.log" 2>&1 &
wait_for "http://127.0.0.1:${METRO_PORT}/status" "Metro"
say "  healthy  (log: $LOG_DIR/metro.log)"

say "Emulator"
if ! adb get-state >/dev/null 2>&1; then
  say "  !! no device. Start one, then re-run."
  exit 1
fi
adb reverse tcp:3000 "tcp:${BACKEND_PORT}" >/dev/null
adb reverse tcp:8081 "tcp:${METRO_PORT}" >/dev/null
adb reverse tcp:54321 "tcp:${SUPABASE_PORT}" >/dev/null
say "  device 3000 -> $BACKEND_PORT | device 8081 -> $METRO_PORT | device 54321 -> $SUPABASE_PORT"

say ""
say "Ready. Launch with:"
say "  adb shell am start -a android.intent.action.MAIN \\"
say "    -c android.intent.category.LAUNCHER -n app.pulpe.android/.MainActivity"
