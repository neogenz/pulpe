#!/bin/bash

# Script pour synchroniser les fichiers .env depuis le workspace principal

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Chemins sources
SOURCE_BACKEND_ENV="/Users/maximedesogus/workspace/perso/pulpe-workspace/backend-nest/.env"
SOURCE_ROOT_ENV="/Users/maximedesogus/workspace/perso/pulpe-workspace/.env"
SOURCE_BACKEND_ENV_LOCAL="/Users/maximedesogus/workspace/perso/pulpe-workspace/backend-nest/.env.local"
SOURCE_BACKEND_ENV_DEVELOPMENT="/Users/maximedesogus/workspace/perso/pulpe-workspace/backend-nest/.env.development"

# Répertoire du projet courant (où le script est exécuté)
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Chemins de destination
DEST_BACKEND_ENV="$CURRENT_DIR/backend-nest/.env"
DEST_ROOT_ENV="$CURRENT_DIR/.env"
DEST_BACKEND_ENV_LOCAL="$CURRENT_DIR/backend-nest/.env.local"
DEST_BACKEND_ENV_DEVELOPMENT="$CURRENT_DIR/backend-nest/.env.development"

echo -e "${YELLOW}🔄 Synchronisation des fichiers .env...${NC}"

# Fonction pour copier un fichier .env
copy_env_file() {
    local source=$1
    local dest=$2
    local name=$3
    
    if [ -f "$source" ]; then
        # Créer le répertoire de destination si nécessaire
        mkdir -p "$(dirname "$dest")"
        
        # Copier le fichier
        cp "$source" "$dest"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ $name copié avec succès${NC}"
            echo "   Source: $source"
            echo "   Destination: $dest"
        else
            echo -e "${RED}❌ Erreur lors de la copie de $name${NC}"
            return 1
        fi
    else
        echo -e "${RED}⚠️  $name source non trouvé: $source${NC}"
        return 1
    fi
}

# Copier le fichier .env du backend
copy_env_file "$SOURCE_BACKEND_ENV" "$DEST_BACKEND_ENV" "Backend .env"

# Copier le fichier .env.local du backend
copy_env_file "$SOURCE_BACKEND_ENV_LOCAL" "$DEST_BACKEND_ENV_LOCAL" "Backend .env.local"

# Copier le fichier .env.development du backend
copy_env_file "$SOURCE_BACKEND_ENV_DEVELOPMENT" "$DEST_BACKEND_ENV_DEVELOPMENT" "Backend .env.development"

echo ""

# Copier le fichier .env de la racine
copy_env_file "$SOURCE_ROOT_ENV" "$DEST_ROOT_ENV" "Root .env"

echo ""
echo -e "${GREEN}✨ Synchronisation terminée !${NC}"

# Afficher un rappel pour .gitignore
echo ""
echo -e "${YELLOW}📝 Rappel: Assurez-vous que les fichiers .env sont dans votre .gitignore${NC}"