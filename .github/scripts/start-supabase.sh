#!/usr/bin/env bash
# Start the local Supabase stack for CI.
#
# public.ecr.aws throttles anonymous pulls per source IP, and GitHub-hosted
# runners share a NAT pool — so image pulls intermittently die on
# "toomanyrequests: Rate exceeded". The CLI retries on its own but caps the
# backoff at 8s, far too short for the limiter to refill, and then tears the
# stack down. Retrying the whole start with a real pause makes those runs
# self-heal instead of failing the job.
set -uo pipefail

# Keep postgres-meta because the type-generation step needs it. Its image
# pull must happen inside this script's retry loop, not afterward. It only
# serves `gen types`, so a caller whose DB contract is untouched skips its
# pull entirely with SUPABASE_SKIP_PG_META=1.
EXCLUDE="studio,mailpit,imgproxy,edge-runtime,realtime,storage-api,logflare,vector"
if [ "${SUPABASE_SKIP_PG_META:-0}" = "1" ]; then
  EXCLUDE="$EXCLUDE,postgres-meta"
fi
ATTEMPTS="${SUPABASE_START_ATTEMPTS:-3}"
BACKOFF="${SUPABASE_START_BACKOFF:-60}"

for attempt in $(seq 1 "$ATTEMPTS"); do
  if supabase start --exclude "$EXCLUDE"; then
    exit 0
  fi

  if [ "$attempt" -eq "$ATTEMPTS" ]; then
    echo "::error::supabase start failed after $ATTEMPTS attempts"
    exit 1
  fi

  echo "::warning::supabase start failed (attempt $attempt/$ATTEMPTS), retrying in ${BACKOFF}s"
  # Drop the half-started stack and its volumes so the retry starts clean.
  supabase stop --no-backup >/dev/null 2>&1 || true
  sleep "$BACKOFF"
done
