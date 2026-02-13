#!/bin/bash
set -e

# ── Resolve linked project ──────────────────────────────────────────
ref_file="supabase/.temp/project-ref"
if [ ! -f "$ref_file" ]; then
  echo "❌ No linked project found. Run 'supabase link' first."
  exit 1
fi

project_ref=$(cat "$ref_file")
derived_url="https://${project_ref}.supabase.co"

# ── Read secrets from .env.development ───────────────────────────────
srk=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" .env.development 2>/dev/null | cut -d= -f2-)
master_key=$(grep -E "^ENCRYPTION_MASTER_KEY=" .env.development 2>/dev/null | cut -d= -f2-)

# ── Display warning ─────────────────────────────────────────────────
echo ""
echo "⚠️  WARNING: This will RESET the linked remote database and re-seed it."
echo ""
echo "   Linked project:  $project_ref"
echo "   SUPABASE_URL:    $derived_url (derived from linked project)"

if [ -n "$srk" ]; then
  echo "   SERVICE_ROLE_KEY: ${srk:0:12}... (from .env.development)"
else
  echo "   SERVICE_ROLE_KEY: ❌ NOT SET in .env.development"
fi

if [ -n "$master_key" ]; then
  echo "   MASTER_KEY:       ${master_key:0:8}...${master_key: -8} (from .env.development)"
else
  echo "   MASTER_KEY:       ❌ NOT SET in .env.development"
fi

if [ -z "$srk" ] || [ -z "$master_key" ]; then
  echo ""
  echo "❌ Missing secrets in .env.development. Add SUPABASE_SERVICE_ROLE_KEY and ENCRYPTION_MASTER_KEY."
  exit 1
fi

echo ""
echo "   ⚡ IMPORTANT: Le backend preview doit avoir le MÊME ENCRYPTION_MASTER_KEY"
echo "   que celui affiché ci-dessus, sinon le PIN ne fonctionnera pas."
echo ""
read -p "Continue? (y/N) " confirm
if [ "$confirm" != "y" ]; then
  echo "Aborted."
  exit 0
fi

# ── Reset and encrypt ───────────────────────────────────────────────
echo ""
supabase db reset --linked

export SUPABASE_URL="$derived_url"
export SUPABASE_SERVICE_ROLE_KEY="$srk"
export ENCRYPTION_MASTER_KEY="$master_key"
bun scripts/encrypt-seed-data.ts

# ── Unlink to prevent accidental operations on remote DB ─────────
supabase unlink
