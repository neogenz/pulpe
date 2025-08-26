#!/bin/bash

# Script d'installation NPM avec retry et exponential backoff
# Usage: ./npm-install-retry.sh [command] [max_attempts]

set -euo pipefail

COMMAND="${1:-pnpm install --frozen-lockfile}"
MAX_ATTEMPTS="${2:-5}"
BASE_DELAY=2

echo "🚀 Starting NPM installation with retry strategy"
echo "Command: $COMMAND"
echo "Max attempts: $MAX_ATTEMPTS"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    echo ""
    echo "📦 Attempt $attempt/$MAX_ATTEMPTS: Running $COMMAND"
    
    if eval "$COMMAND"; then
        echo "✅ Installation successful on attempt $attempt"
        exit 0
    else
        exit_code=$?
        
        if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
            echo "❌ Installation failed after $MAX_ATTEMPTS attempts"
            exit $exit_code
        fi
        
        # Calcul du délai avec exponential backoff (compatible avec tous les shells)
        delay=$BASE_DELAY
        for ((i=1; i<attempt; i++)); do
            delay=$((delay * BASE_DELAY))
        done
        # Limite max à 60 secondes
        if [ "$delay" -gt 60 ]; then
            delay=60
        fi
        
        echo "⚠️  Attempt $attempt failed (exit code: $exit_code)"
        echo "⏳ Waiting ${delay}s before retry..."
        sleep "$delay"
        
        # Nettoyage du cache en cas d'échec pour éviter la corruption
        if command -v pnpm >/dev/null 2>&1; then
            echo "🧹 Clearing pnpm cache..."
            pnpm store prune --force || true
        elif command -v npm >/dev/null 2>&1; then
            echo "🧹 Clearing npm cache..."
            npm cache clean --force || true
        fi
    fi
done