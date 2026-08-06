#!/usr/bin/env bash
# install-skills.sh
# Idempotent skills sync. Canonical set = skills-lock.json.
#
# Steps:
#   1. Wipe ignored .agents/skills/* and .claude/skills/* symlinks (preserve git-tracked dirs)
#   2. Run the pinned skills CLI to hydrate from lockfile without modifying it
#   3. In worktrees, symlink Pulpe-custom skills from main repo's .claude/skills/
#
# Usage:
#   ./scripts/install-skills.sh              # Sync from lockfile
#   ./scripts/install-skills.sh add <src>    # Non-interactive add (preset choices)
#   ./scripts/install-skills.sh /path        # Sync at specific path

set -euo pipefail

# ─── Subcommand: non-interactive add ─────────────────────────────────────
# Presets: all agents, project scope, symlink method, no confirm.
if [[ "${1:-}" == "add" ]]; then
  shift
  if [[ $# -lt 1 ]]; then
    echo "Usage: $0 add <source> [extra-skills-flags...]"
    exit 1
  fi
  exec pnpx skills@1.5.22 add "$@" --agent '*' -y
fi

WORKTREE="${1:-$(pwd)}"
cd "$WORKTREE"

LOCKFILE="$WORKTREE/skills-lock.json"
if [[ ! -f "$LOCKFILE" ]]; then
  echo "✗ No skills-lock.json found at $LOCKFILE"
  exit 1
fi

# 1. Wipe ignored .agents/skills/* and .claude/skills/* symlinks.
#    Keep git-tracked Pulpe skills and symlinks.
echo "→ Cleaning existing skills..."
if [[ -d "$WORKTREE/.agents/skills" ]]; then
  git clean -fdX -- .agents/skills
fi
if [[ -d "$WORKTREE/.claude/skills" ]]; then
  for entry in "$WORKTREE"/.claude/skills/*; do
    [[ -L "$entry" ]] && rm -f "$entry"
  done
fi

# 3. Hydrate from lockfile. The CLI refreshes computed hashes during restore,
#    so preserve the canonical input byte-for-byte, including pending changes.
echo "→ Installing skills from skills-lock.json..."
LOCKFILE_BACKUP="$(mktemp)"
cp "$LOCKFILE" "$LOCKFILE_BACKUP"
restore_lockfile() {
  cp "$LOCKFILE_BACKUP" "$LOCKFILE"
  rm -f "$LOCKFILE_BACKUP"
}
trap restore_lockfile EXIT
pnpx skills@1.5.22 experimental_install -y
restore_lockfile
trap - EXIT

# 4. Symlink .agents/skills/* into .claude/skills/ so Claude Code can see them
#    (Claude Code reads .claude/skills/, not .agents/skills/)
mkdir -p "$WORKTREE/.claude/skills"
synced=0
for skill in "$WORKTREE"/.agents/skills/*; do
  [[ -d "$skill" ]] || continue
  name="$(basename "$skill")"
  target="$WORKTREE/.claude/skills/$name"
  [[ -e "$target" || -L "$target" ]] && continue
  ln -s "../../.agents/skills/$name" "$target"
  synced=$((synced + 1))
done
if (( synced > 0 )); then
  echo "✓ Linked $synced skills into .claude/skills/"
fi

# 5. Worktree-only: recreate missing .claude/skills symlinks from main repo
MAIN_REPO="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
if [[ "$(cd "$WORKTREE" && pwd -P)" == "$(cd "$MAIN_REPO" && pwd -P)" ]]; then
  exit 0
fi

mkdir -p "$WORKTREE/.claude/skills"
linked=0
for skill in "$MAIN_REPO"/.claude/skills/*; do
  [[ -L "$skill" ]] || continue
  name="$(basename "$skill")"
  target="$WORKTREE/.claude/skills/$name"
  [[ -e "$target" || -L "$target" ]] && continue
  ln -s "$(readlink "$skill")" "$target"
  linked=$((linked + 1))
done

if (( linked > 0 )); then
  echo "✓ Linked $linked skills to worktree .claude/skills/"
fi
