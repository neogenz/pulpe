#!/usr/bin/env bash
#
# pul209-verify.sh — capture six BudgetDetailsView states for visual diff.
#
# Builds the iOS app once, installs it on the iPhone 17 Pro Max simulator, then
# loops through six DEBUG-only launch scenarios that mount `PUL209VerifyHarness`
# and screenshot the resulting UI. Output PNGs land in `/tmp/pul209-verify/`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="${REPO_ROOT}/ios"
DERIVED_DATA="/tmp/pul209-verify-build"
SCREENSHOT_DIR="/tmp/pul209-verify"
APP_BUNDLE_ID="app.pulpe.ios"
SIMULATOR_NAME="iPhone 17 Pro Max"
SETTLE_SECONDS=5

mkdir -p "${SCREENSHOT_DIR}"

echo "==> Generating Xcode project"
(cd "${IOS_DIR}" && xcodegen generate >/dev/null)

echo "==> Building PulpeLocal scheme"
xcodebuild build \
    -project "${IOS_DIR}/Pulpe.xcodeproj" \
    -scheme PulpeLocal \
    -destination "platform=iOS Simulator,name=${SIMULATOR_NAME}" \
    -derivedDataPath "${DERIVED_DATA}" \
    CODE_SIGNING_ALLOWED=NO \
    >/dev/null

APP_PATH="${DERIVED_DATA}/Build/Products/Local-iphonesimulator/Pulpe.app"
if [[ ! -d "${APP_PATH}" ]]; then
    echo "ERROR: built .app not found at ${APP_PATH}" >&2
    exit 1
fi

echo "==> Booting simulator (${SIMULATOR_NAME})"
xcrun simctl boot "${SIMULATOR_NAME}" >/dev/null 2>&1 || true
xcrun simctl bootstatus "${SIMULATOR_NAME}" -b >/dev/null

echo "==> Installing app"
xcrun simctl install booted "${APP_PATH}"

# scenario_name : launch_arg
SCENARIOS=(
    "01-mixed:PUL209_VERIFY_MIXED"
    "02-filter-expense:PUL209_VERIFY_FILTER_EXPENSE"
    "03-filter-checked:PUL209_VERIFY_FILTER_CHECKED"
    "04-sheet-open:PUL209_VERIFY_SHEET_OPEN"
    "05-sheet-pointed:PUL209_VERIFY_SHEET_POINTED"
    "06-sheet-menu:PUL209_VERIFY_SHEET_MENU"
)

for entry in "${SCENARIOS[@]}"; do
    name="${entry%%:*}"
    arg="${entry##*:}"
    output="${SCREENSHOT_DIR}/${name}.png"

    echo "==> Capturing ${name} (${arg})"
    xcrun simctl terminate booted "${APP_BUNDLE_ID}" >/dev/null 2>&1 || true
    rm -f "${output}"
    xcrun simctl launch booted "${APP_BUNDLE_ID}" "-${arg}" >/dev/null
    # The harness writes the PNG into the app sandbox after a 3.5s settle.
    # `simctl io booted screenshot` is unreliable under headless conditions;
    # the in-app drawHierarchy snapshot is the load-bearing path.
    sleep "${SETTLE_SECONDS}"
    APP_DATA="$(xcrun simctl get_app_container booted "${APP_BUNDLE_ID}" data 2>/dev/null || true)"
    SANDBOX_PNG="${APP_DATA}/Documents/${name}.png"
    for _ in 1 2 3 4 5; do
        if [[ -f "${SANDBOX_PNG}" ]]; then
            cp "${SANDBOX_PNG}" "${output}"
            break
        fi
        sleep 1
    done
    if [[ -f "${output}" ]]; then
        echo "    OK ${output}"
    else
        echo "    FAIL ${SANDBOX_PNG} not produced"
    fi
done

echo
echo "Screenshots written to:"
for entry in "${SCENARIOS[@]}"; do
    name="${entry%%:*}"
    echo "  ${SCREENSHOT_DIR}/${name}.png"
done
