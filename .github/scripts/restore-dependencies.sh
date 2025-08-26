#!/bin/bash

# Script pour restaurer les dépendances avec fallback
# Usage: ./restore-dependencies.sh [cache_hit] [run_id]

set -euo pipefail

CACHE_HIT="${1:-false}"
RUN_ID="${2:-}"

echo "🔄 Restoring dependencies..."
echo "Cache hit: $CACHE_HIT"
echo "Run ID: $RUN_ID"

# Si le cache a fonctionné, pas besoin de télécharger l'artifact
if [ "$CACHE_HIT" = "true" ]; then
    echo "✅ Using cached node_modules"
    
    # Vérification que le cache fonctionne bien
    if [ ! -d "node_modules" ]; then
        echo "⚠️  Cache hit but node_modules missing, will fallback to install"
        CACHE_HIT="false"
    fi
fi

# Si pas de cache hit, on essaie d'utiliser l'artifact
if [ "$CACHE_HIT" != "true" ]; then
    echo "📥 Cache miss, checking for node_modules directory..."
    
    # Vérifier si les node_modules sont présents (artifact téléchargé)
    if [ -d "node_modules" ] && [ -d "frontend/node_modules" ] && [ -d "backend-nest/node_modules" ]; then
        echo "✅ Dependencies artifact found and restored"
    else
        echo "⚠️  Dependencies not found, falling back to install with retry..."
        
        # Fallback: installation avec retry
        if [ -f ".github/scripts/npm-install-retry.sh" ]; then
            chmod +x .github/scripts/npm-install-retry.sh
            ./.github/scripts/npm-install-retry.sh "pnpm install --frozen-lockfile --prefer-offline"
        else
            echo "🔄 Retry script not found, using direct install..."
            pnpm install --frozen-lockfile --prefer-offline
        fi
    fi
fi

echo "✅ Dependencies ready"