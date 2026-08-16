#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd)
WORKSPACE_DIR=$(cd "$SKILL_DIR/../../.." && pwd)
CAPTURE_DRIVER="$SKILL_DIR/scripts/capture.py"
BACKEND_DIR="$WORKSPACE_DIR/backend-nest"

BACKEND_PID=$(lsof -nP -iTCP:3000 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -n 1 || true)
if [[ -z "$BACKEND_PID" ]]; then
  echo "No backend is listening on port 3000. Start this workspace's backend first." >&2
  exit 1
fi
BACKEND_CWD=$(lsof -a -p "$BACKEND_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
if [[ "$BACKEND_CWD" != "$BACKEND_DIR" ]]; then
  echo "Port 3000 belongs to another worktree: $BACKEND_CWD" >&2
  exit 1
fi
curl --fail --silent http://127.0.0.1:3000/health >/dev/null

CAPTURE_DEVICE_ID=$(python3 "$CAPTURE_DRIVER" device)

(cd "$WORKSPACE_DIR/ios" &&
  xcodegen generate --use-cache &&
  xcodebuild -project Pulpe.xcodeproj -scheme PulpeLocal \
    -destination "id=$CAPTURE_DEVICE_ID" CODE_SIGNING_ALLOWED=NO build -quiet)

APP_PATH=$(cd "$WORKSPACE_DIR/ios" &&
  xcodebuild -project Pulpe.xcodeproj -scheme PulpeLocal \
    -destination "id=$CAPTURE_DEVICE_ID" -showBuildSettings -json |
  python3 -c 'import json, sys; s = next(x["buildSettings"] for x in json.load(sys.stdin) if x["target"] == "Pulpe"); print(s["TARGET_BUILD_DIR"] + "/" + s["WRAPPER_NAME"])')

python3 "$CAPTURE_DRIVER" run --udid "$CAPTURE_DEVICE_ID" \
  --app "$APP_PATH" "$@"
