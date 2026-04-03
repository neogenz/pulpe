#!/usr/bin/env bash
# sync-worktree-skills.sh
# Restores pnpx-skills in a git worktree:
#   1. pnpx skills experimental_install (from skills-lock.json)
#   2. Recreate .claude/skills/ symlinks (not done by experimental_install)
#
# Usage:
#   ./scripts/sync-worktree-skills.sh          # Run from any worktree
#   ./scripts/sync-worktree-skills.sh /path    # Specify worktree path

set -euo pipefail

WORKTREE="${1:-$(pwd)}"
cd "$WORKTREE"

MAIN_REPO="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"

if [[ "$(cd "$WORKTREE" && pwd -P)" == "$(cd "$MAIN_REPO" && pwd -P)" ]]; then
  exit 0
fi

# 1. Restore skills from lockfile
echo "→ Installing skills from skills-lock.json..."
pnpx skills experimental_install

# 2. Recreate .claude/skills/ symlinks
mkdir -p "$WORKTREE/.claude/skills"

linked=0
skipped=0

for skill in "$MAIN_REPO"/.claude/skills/*; do
  name="$(basename "$skill")"
  target="$WORKTREE/.claude/skills/$name"

  # Skip real dirs (git-tracked)
  [[ ! -L "$skill" ]] && continue

  # Skip if already exists
  if [[ -e "$target" || -L "$target" ]]; then
    ((skipped++))
    continue
  fi

  link_target="$(readlink "$skill")"
  ln -s "$link_target" "$target"
  ((linked++))
done

if [[ $linked -gt 0 ]]; then
  echo "✓ Linked $linked skills to Claude Code"
fi
if [[ $skipped -gt 0 ]]; then
  echo "  Skipped $skipped (already present)"
fi
