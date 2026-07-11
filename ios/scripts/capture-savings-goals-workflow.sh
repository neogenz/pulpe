#!/usr/bin/env bash
#
# capture-savings-goals-workflow.sh
#
# Local, non-CI capture of the savings goals journey on the seed account.
# Produces four real screenshots + a video WITHOUT ever leaving the capture
# secrets in the shareable artifacts folder, a committed file, or argv.
#
# Requires, exported in your shell (never commit them):
#     PULPE_CAPTURE_EMAIL, PULPE_CAPTURE_PASSWORD, PULPE_CAPTURE_PIN
# and the local stack up:
#     supabase start          # Supabase on :54321
#     pnpm dev:backend        # Nest API on :3000
# and one booted iOS simulator (open it in Xcode, or `xcrun simctl boot ...`).
#
# Output (git-ignored): artifacts/ios-savings-workflow-real/
#   Note: the video briefly shows the masked PIN pad (the vault re-locks on cold
#   start, so the capture re-enters the PIN) — no email, no plaintext. REVIEW
#   before sharing.
#
# Usage:  ios/scripts/capture-savings-goals-workflow.sh
#
set -euo pipefail   # NB: never add `set -x` — it would echo the secrets.

# --- locations -------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$IOS_DIR/.." && pwd)"
OUT_DIR="$REPO_DIR/artifacts/ios-savings-workflow-real"
PROJECT="$IOS_DIR/Pulpe.xcodeproj"
SCHEME="PulpeUITests"
CONFIG="Local"
SUITE="PulpeUITests/SavingsGoalsSeedWorkflowTests"
API_URL="http://localhost:3000/api/v1"
SUPABASE_URL="http://127.0.0.1:54321"

# --- required secrets (fail fast, message only — never echo the value) -----
: "${PULPE_CAPTURE_EMAIL:?set PULPE_CAPTURE_EMAIL in your shell (never commit it)}"
: "${PULPE_CAPTURE_PASSWORD:?set PULPE_CAPTURE_PASSWORD in your shell}"
: "${PULPE_CAPTURE_PIN:?set PULPE_CAPTURE_PIN in your shell}"

# --- scratch dir for every secret-bearing artifact -------------------------
# xcodebuild activity logs AND result bundles record the typed email and the
# ordered PIN digit taps verbatim, so they must never touch the shareable
# OUT_DIR. Keep them here and scrub on EVERY exit path.
SECRET_TMP="$(mktemp -d "${TMPDIR:-/tmp}/pulpe-capture.XXXXXX")"
REC_PID=""
cleanup() {
  if [ -n "$REC_PID" ] && kill -0 "$REC_PID" 2>/dev/null; then
    kill -INT "$REC_PID" 2>/dev/null || true
    wait "$REC_PID" 2>/dev/null || true
  fi
  rm -rf "$SECRET_TMP" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- preflight: local stack must be reachable ------------------------------
echo "▸ Preflight: Supabase + Nest API"
curl -fsS -o /dev/null "$SUPABASE_URL/auth/v1/health" \
  || { echo "✘ Supabase local unreachable at $SUPABASE_URL — run 'supabase start'"; exit 1; }
curl -fsS -o /dev/null "$API_URL/health" 2>/dev/null \
  || curl -fsS -o /dev/null "$API_URL" 2>/dev/null \
  || { echo "✘ Nest API unreachable at $API_URL — run 'pnpm dev:backend'"; exit 1; }

# --- booted simulator ------------------------------------------------------
DEVICE_ID="$(xcrun simctl list devices booted | grep -Eo '[0-9A-Fa-f-]{36}' | head -1)"
[ -n "$DEVICE_ID" ] || { echo "✘ No booted simulator — boot one in Xcode first."; exit 1; }
echo "▸ Simulator: $DEVICE_ID"

# Project is generated; make sure the new capture test is in the target.
( cd "$IOS_DIR" && xcodegen generate --use-cache >/dev/null )

mkdir -p "$OUT_DIR"

# --- 1) Bootstrap: login (email + password + PIN), no video ----------------
# TEST_RUNNER_* vars are forwarded to the UI-test runner process with the prefix
# stripped, so the test reads PULPE_CAPTURE_* from ProcessInfo without the values
# ever reaching argv, a plist, or a committed file.
echo "▸ Bootstrapping authenticated session (no video)…"
TEST_RUNNER_PULPE_CAPTURE_EMAIL="$PULPE_CAPTURE_EMAIL" \
TEST_RUNNER_PULPE_CAPTURE_PASSWORD="$PULPE_CAPTURE_PASSWORD" \
TEST_RUNNER_PULPE_CAPTURE_PIN="$PULPE_CAPTURE_PIN" \
xcodebuild test \
  -project "$PROJECT" -scheme "$SCHEME" -configuration "$CONFIG" \
  -destination "platform=iOS Simulator,id=$DEVICE_ID" \
  -only-testing:"$SUITE/testBootstrapAuthenticatedSession" \
  -resultBundlePath "$SECRET_TMP/bootstrap.xcresult" \
  > "$SECRET_TMP/bootstrap.log" 2>&1 \
  || { echo "✘ Bootstrap failed. Its log held the typed email + PIN, so it was withheld — re-run the test from Xcode to debug."; exit 1; }

# Email + password are no longer needed; the persisted session covers auth. Only
# the PIN is still needed (the vault re-locks on the capture cold start).
unset PULPE_CAPTURE_EMAIL PULPE_CAPTURE_PASSWORD || true
echo "✔ Authenticated (session persisted; capture will re-enter the PIN to unlock the vault)."

# --- 2) Record video around the capture test (PIN unlock — masked, no email)
VIDEO="$OUT_DIR/workflow-compte-seed.mp4"
echo "▸ Recording video → $VIDEO"
xcrun simctl io "$DEVICE_ID" recordVideo --codec h264 --force "$VIDEO" &
REC_PID=$!

echo "▸ Capturing the journey…"
TEST_RUNNER_PULPE_CAPTURE_PIN="$PULPE_CAPTURE_PIN" \
xcodebuild test \
  -project "$PROJECT" -scheme "$SCHEME" -configuration "$CONFIG" \
  -destination "platform=iOS Simulator,id=$DEVICE_ID" \
  -only-testing:"$SUITE/testCaptureSavingsGoalsWorkflow" \
  -resultBundlePath "$SECRET_TMP/capture.xcresult" \
  > "$SECRET_TMP/capture.log" 2>&1 \
  || { echo "✘ Capture failed. Its log held the PIN taps, so it was withheld — re-run the test from Xcode to debug."; exit 1; }
unset PULPE_CAPTURE_PIN || true

# Stop recording before exporting.
if kill -0 "$REC_PID" 2>/dev/null; then
  kill -INT "$REC_PID" 2>/dev/null || true
  wait "$REC_PID" 2>/dev/null || true
fi
REC_PID=""

# --- 3) Export the four journey screenshots to the shareable folder ---------
# Only the named XCTAttachments (the post-unlock journey screens) are exported;
# the capture result bundle itself stays in SECRET_TMP (its activity log holds
# the PIN taps) and is scrubbed on exit.
echo "▸ Exporting screenshots"
xcrun xcresulttool export attachments \
  --path "$SECRET_TMP/capture.xcresult" \
  --output-path "$OUT_DIR" >/dev/null 2>&1 \
  || echo "⚠ Auto-export failed (xcresulttool version drift). Re-run testCaptureSavingsGoalsWorkflow from Xcode and drag the 4 named PNGs into $OUT_DIR."

echo ""
echo "✔ Done. REVIEW BEFORE SHARING — confirm no readable email/PIN is visible"
echo "  (the video briefly shows a masked PIN pad by design):"
echo "  $OUT_DIR"
ls -1 "$OUT_DIR" 2>/dev/null || true
