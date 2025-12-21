#!/bin/bash
#
# sync-env.sh - Synchronise les fichiers .env depuis le workspace principal vers un worktree
#
# Usage: ./sync-env.sh
#
# Ce script copie tous les fichiers .env du workspace principal (SOURCE_WORKSPACE)
# vers le répertoire courant. Utile après création d'un git worktree.

set -e

# ==============================================================================
# Configuration
# ==============================================================================

# Workspace principal contenant les .env de référence
# Définir PULPE_MAIN_WORKSPACE dans ton shell ou modifier ce fallback
SOURCE_WORKSPACE="${PULPE_MAIN_WORKSPACE:-$HOME/workspace/perso/pulpe-workspace}"

# Répertoire du worktree courant
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Liste des fichiers .env à synchroniser (chemin relatif depuis la racine)
ENV_FILES=(
    ".env"
    "frontend/.env"
    "backend-nest/.env"
    "backend-nest/.env.local"
    "backend-nest/.env.development"
)

# ==============================================================================
# Couleurs
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==============================================================================
# Fonctions
# ==============================================================================

copy_env() {
    local relative_path=$1
    local source="$SOURCE_WORKSPACE/$relative_path"
    local dest="$CURRENT_DIR/$relative_path"

    if [[ ! -f "$source" ]]; then
        echo -e "${RED}⚠️  Non trouvé: $relative_path${NC}"
        return 1
    fi

    mkdir -p "$(dirname "$dest")"

    if cp "$source" "$dest"; then
        echo -e "${GREEN}✅ $relative_path${NC}"
    else
        echo -e "${RED}❌ Erreur: $relative_path${NC}"
        return 1
    fi
}

# ==============================================================================
# Main
# ==============================================================================

echo -e "${YELLOW}Synchronisation des .env depuis:${NC}"
echo "   $SOURCE_WORKSPACE"
echo ""

for env_file in "${ENV_FILES[@]}"; do
    copy_env "$env_file"
done

echo ""
echo -e "${GREEN}Synchronisation terminée.${NC}"
