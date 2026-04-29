#!/usr/bin/env bash
# install-skills.sh
# Idempotent skills sync. Canonical set = skills-lock.json.
#
# Steps:
#   1. Wipe .agents/skills/* and .claude/skills/* symlinks (preserve git-tracked dirs)
#   2. Run `pnpx skills experimental_install -y` to hydrate from lockfile
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
  exec pnpx skills add "$@" --agent '*' -y
fi

WORKTREE="${1:-$(pwd)}"
cd "$WORKTREE"

LOCKFILE="$WORKTREE/skills-lock.json"
if [[ ! -f "$LOCKFILE" ]]; then
  echo "✗ No skills-lock.json found at $LOCKFILE"
  exit 1
fi

# 1. Nuke: wipe ALL .agents/skills/* and .claude/skills/* symlinks
#    (keep git-tracked real dirs in .claude/skills/ — Pulpe-custom skills)
echo "→ Cleaning existing skills..."
if [[ -d "$WORKTREE/.agents/skills" ]]; then
  rm -rf "$WORKTREE"/.agents/skills/*
fi
if [[ -d "$WORKTREE/.claude/skills" ]]; then
  for entry in "$WORKTREE"/.claude/skills/*; do
    [[ -L "$entry" ]] && rm -f "$entry"
  done
fi

# 3. Hydrate from lockfile
echo "→ Installing skills from skills-lock.json..."
pnpx skills experimental_install -y

# 4. Worktree-only: recreate missing .claude/skills symlinks from main repo
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

(( linked > 0 )) && echo "✓ Linked $linked skills to worktree .claude/skills/"
