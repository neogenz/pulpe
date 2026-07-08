#!/bin/bash
#
# SessionStart hook (matcher: startup). Syncs .env files into a fresh git
# worktree exactly ONCE — the first session that opens in it. Cloud/agent
# worktrees are pre-created by the harness before the session starts, so
# SessionStart is the only lifecycle event that provably runs inside the
# session after the worktree exists (WorktreeCreate does not fire for this
# path, and no EnterWorktree tool call happens). An idempotency marker in the
# worktree's private git dir makes every later session a ~1ms no-op — no
# repeated sync, no model tokens (a command hook is a shell process, not an
# LLM call).
#
# Never blocks session start: any failure here is non-fatal.

# No `-e`: failures here must never block session start; each is handled
# explicitly. No `pipefail` either — nothing consumes a pipeline's status.
set -u

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CWD="${CWD:-$PWD}"

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0

if [[ ! -f "$REPO_ROOT/.git" ]]; then
  # .git is a directory here → main checkout, not a worktree. Nothing to do.
  exit 0
fi

# Per-worktree, never-committed marker (lives in this worktree's private git
# dir). Present → already synced once → instant no-op.
MARKER=$(git -C "$CWD" rev-parse --git-path pulpe-env-synced 2>/dev/null) || exit 0
[[ -f "$MARKER" ]] && exit 0

if [[ ! -x "$REPO_ROOT/sync-env.sh" ]]; then
  exit 0
fi

if [[ -z "${CONDUCTOR_ROOT_PATH:-}" && -z "${PULPE_MAIN_WORKSPACE:-}" ]]; then
  # sync-env.sh needs one of these to know the source workspace; skip quietly
  # (do NOT write the marker — a later session with the var set still syncs).
  exit 0
fi

# sync-env.sh colorizes with ANSI escapes; strip them so they don't show up
# raw in the systemMessage shown to Claude Code.
OUTPUT=$("$REPO_ROOT/sync-env.sh" 2>&1)
STATUS=$?
OUTPUT=$(printf '%s' "$OUTPUT" | sed $'s/\033\\[[0-9;]*m//g')

if [[ $STATUS -eq 0 ]]; then
  touch "$MARKER"
else
  # A configured source (CONDUCTOR_ROOT_PATH/PULPE_MAIN_WORKSPACE) failed to
  # sync — surface it instead of swallowing it, and leave the marker unset so
  # the next session retries.
  jq -n --arg msg "sync-env.sh a échoué au démarrage de la session :
$OUTPUT" '{systemMessage: $msg}'
fi

exit 0
