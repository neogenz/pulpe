#!/usr/bin/env bash
# sync-rules-to-cursor.sh
# Source of truth: .claude/rules/**/*.md → .cursor/rules/**/*.mdc
# Converts Claude Code frontmatter (paths:) to Cursor frontmatter (globs: + alwaysApply:)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_RULES="$REPO_ROOT/.claude/rules"
CURSOR_RULES="$REPO_ROOT/.cursor/rules"

# Clean .cursor/rules/ completely before syncing
if [[ -d "$CURSOR_RULES" ]]; then
  rm -rf "$CURSOR_RULES"
  echo "✗ Cleaned .cursor/rules/"
fi

synced=0
skipped=0
errors=0

# Find all .md rule files in .claude/rules/
while IFS= read -r src; do
  # Relative path from .claude/rules/ (e.g. 00-architecture/angular-architecture.md)
  rel="${src#$CLAUDE_RULES/}"
  dir="$(dirname "$rel")"
  base="$(basename "$rel" .md)"
  dest="$CURSOR_RULES/$dir/${base}.mdc"

  # Create target directory
  mkdir -p "$CURSOR_RULES/$dir"

  # Extract frontmatter and body
  if ! head -1 "$src" | grep -q "^---$"; then
    echo "⚠ Skipping $rel (no frontmatter)"
    ((skipped++))
    continue
  fi

  # Parse frontmatter fields
  description=""
  paths_value=""
  in_frontmatter=false
  frontmatter_end=0
  line_num=0

  while IFS= read -r line; do
    ((line_num++))
    if [[ $line_num -eq 1 && "$line" == "---" ]]; then
      in_frontmatter=true
      continue
    fi
    if $in_frontmatter && [[ "$line" == "---" ]]; then
      frontmatter_end=$line_num
      break
    fi
    if $in_frontmatter; then
      # Extract description (handle quoted and unquoted)
      if [[ "$line" =~ ^description:[[:space:]]*(.*) ]]; then
        description="${BASH_REMATCH[1]}"
        # Strip surrounding quotes if present
        description="${description#\"}"
        description="${description%\"}"
        description="${description#\'}"
        description="${description%\'}"
      fi
      # Extract paths (handle quoted and unquoted)
      if [[ "$line" =~ ^paths:[[:space:]]*(.*) ]]; then
        paths_value="${BASH_REMATCH[1]}"
        paths_value="${paths_value#\"}"
        paths_value="${paths_value%\"}"
        paths_value="${paths_value#\'}"
        paths_value="${paths_value%\'}"
      fi
    fi
  done < "$src"

  if [[ $frontmatter_end -eq 0 ]]; then
    echo "⚠ Skipping $rel (malformed frontmatter)"
    ((errors++))
    continue
  fi

  # Determine alwaysApply
  always_apply="false"
  if [[ -z "$paths_value" || "$paths_value" == "**/*" ]]; then
    always_apply="true"
  fi

  # Build the .mdc file: new frontmatter + original body
  {
    echo "---"
    echo "description: \"$description\""
    if [[ -n "$paths_value" ]]; then
      echo "globs: \"$paths_value\""
    else
      echo "globs: "
    fi
    echo "alwaysApply: $always_apply"
    echo "---"
    # Body = everything after the closing --- of frontmatter
    tail -n +"$((frontmatter_end + 1))" "$src"
  } > "$dest"

  ((synced++))

done < <(find "$CLAUDE_RULES" -name "*.md" -type f | sort)

echo ""
echo "✓ Synced: $synced rules"
[[ $skipped -gt 0 ]] && echo "  Skipped: $skipped (cursor-only or no frontmatter)"
[[ $errors -gt 0 ]] && echo "  Errors: $errors"
echo "  Source: .claude/rules/"
echo "  Target: .cursor/rules/"
