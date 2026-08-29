#!/usr/bin/env bash
# Sends the dSYMs of a release archive to PostHog so crash reports symbolicate.
#
# Usage: ios/scripts/upload-dsyms.sh [path/to/Pulpe.xcarchive]
# Auth: `posthog-cli login` once on a workstation, or POSTHOG_CLI_PROJECT_ID +
# POSTHOG_CLI_API_KEY in the shell (personal key, error-tracking write scope); never in the repo.
# Run it right after `xcodebuild archive` in the publish flow (aidd_docs/memory/deployment.md).
set -euo pipefail

archive="${1:-$(cd "$(dirname "$0")/.." && pwd)/build/Pulpe.xcarchive}"

plist="$archive/Products/Applications/Pulpe.app/Info.plist"
version="$(plutil -extract CFBundleShortVersionString raw "$plist")"
build="$(plutil -extract CFBundleVersion raw "$plist")"

# release-name = the bundle id the SDK sends as $app_namespace on every event.
posthog-cli --host https://eu.posthog.com dsym upload \
  --directory "$archive/dSYMs" \
  --main-dsym Pulpe.app.dSYM \
  --release-name app.pulpe.ios \
  --release-version "$version" \
  --build "$build"
