#!/bin/bash
# Ralph - Autonomous AI Coding Loop
# Usage: ./ralph.sh -f <feature-folder> [-n <max-iterations>]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS=10
FEATURE_FOLDER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--feature)
      FEATURE_FOLDER="$2"
      shift 2
      ;;
    -n|--max)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./ralph.sh -f <feature-folder> [-n <max-iterations>]"
      exit 1
      ;;
  esac
done

if [ -z "$FEATURE_FOLDER" ]; then
  echo "❌ Error: Feature folder required"
  echo "Usage: ./ralph.sh -f <feature-folder> [-n <max-iterations>]"
  echo ""
  echo "Available features:"
  ls -1 "$SCRIPT_DIR/tasks/" 2>/dev/null || echo "  No features found. Create one first!"
  exit 1
fi

TASK_DIR="$SCRIPT_DIR/tasks/$FEATURE_FOLDER"

if [ ! -d "$TASK_DIR" ]; then
  echo "❌ Error: Feature folder not found: $TASK_DIR"
  echo ""
  echo "Available features:"
  ls -1 "$SCRIPT_DIR/tasks/" 2>/dev/null || echo "  No features found"
  exit 1
fi

PRD_FILE="$TASK_DIR/prd.json"
PROGRESS_FILE="$TASK_DIR/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"

if [ ! -f "$PRD_FILE" ]; then
  echo "❌ Error: prd.json not found in $TASK_DIR"
  exit 1
fi

# Get story counts
TOTAL_STORIES=$(jq '.userStories | length' "$PRD_FILE")
COMPLETED=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    🤖 RALPH STARTING                       ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║ Feature: $FEATURE_FOLDER"
echo "║ Stories: $COMPLETED / $TOTAL_STORIES completed"
echo "║ Max iterations: $MAX_ITERATIONS"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

for ((i=1; i<=$MAX_ITERATIONS; i++)); do
  # Refresh counts
  COMPLETED=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
  REMAINING=$((TOTAL_STORIES - COMPLETED))

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "📍 Iteration $i / $MAX_ITERATIONS | Completed: $COMPLETED / $TOTAL_STORIES | Remaining: $REMAINING"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""

  # Run Claude with the prompt
  OUTPUT=$(claude -p --dangerously-skip-permissions \
    "@$PRD_FILE @$PROGRESS_FILE @$PROMPT_FILE" 2>&1 \
    | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ RALPH COMPLETE                       ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║ All $TOTAL_STORIES stories completed in $i iterations!"
    echo "╚════════════════════════════════════════════════════════════╝"
    exit 0
  fi

  sleep 2
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ⚠️  MAX ITERATIONS                       ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║ Reached $MAX_ITERATIONS iterations. Run again to continue."
echo "╚════════════════════════════════════════════════════════════╝"
exit 1
