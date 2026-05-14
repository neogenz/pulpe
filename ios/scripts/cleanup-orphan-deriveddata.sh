#!/usr/bin/env bash
# Trash DerivedData dirs whose Pulpe.xcodeproj path no longer exists.
# Conductor doesn't clean DerivedData when a worktree is archived/deleted,
# so they pile up. Run periodically.
#
# Safe: only touches Pulpe-* dirs whose WorkspacePath is gone from disk.
# Active worktrees and main repo are never touched.
set -euo pipefail

DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"
trashed=0
kept=0

for d in "$DERIVED_DATA"/Pulpe-*/; do
  [ -d "$d" ] || continue
  workspace=$(plutil -extract WorkspacePath raw "$d/info.plist" 2>/dev/null || echo "")
  if [ -z "$workspace" ]; then
    echo "skip (no WorkspacePath): $d"
    kept=$((kept+1))
    continue
  fi
  if [ ! -e "$workspace" ]; then
    size=$(du -sh "$d" 2>/dev/null | cut -f1)
    echo "trash $size  $(basename "$d")  →  orphan: $workspace"
    trash "$d"
    trashed=$((trashed+1))
  else
    size=$(du -sh "$d" 2>/dev/null | cut -f1)
    echo "keep  $size  $(basename "$d")  →  $workspace"
    kept=$((kept+1))
  fi
done

echo ""
echo "Done. Trashed $trashed orphan DerivedData dir(s), kept $kept active."
