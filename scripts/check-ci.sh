#!/bin/bash

# Script de vérification CI pour Pulpe Workspace
# Teste toutes les commandes importantes avant push

set -e

echo "🔍 Vérification CI Pulpe Workspace"
echo "=================================="

# Couleurs pour les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher le statut
log_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "📦 Installation des dépendances..."
pnpm install --frozen-lockfile
log_status "Installation"

echo ""
echo "🏗️  Build des projets..."
pnpm build
log_status "Build"

echo ""
echo "🔍 Vérification du formatage..."
pnpm format:check
log_status "Format check"

echo ""
echo "🔧 Analyse ESLint..."
pnpm lint
log_status "Lint"

echo ""
echo "🧪 Tests unitaires..."
pnpm test:unit
log_status "Tests unitaires"

echo ""
echo "🔬 Analyse qualité complète..."
pnpm quality
log_status "Quality check"

echo ""
echo "🎯 Vérifications spécifiques..."

# Vérifier que les builds produisent les bons outputs
echo "   - Vérification des outputs de build..."
[ -d "shared/dist/esm" ] && echo "     ✅ Shared ESM build" || { echo "     ❌ Shared ESM build manquant"; exit 1; }
[ -f "backend-nest/dist/main.js" ] && echo "     ✅ Backend build" || { echo "     ❌ Backend build manquant"; exit 1; }
[ -d "frontend/dist/webapp" ] && echo "     ✅ Frontend build" || { echo "     ❌ Frontend build manquant"; exit 1; }

# Vérifier les types partagés
echo "   - Vérification des types partagés..."
[ -f "shared/dist/esm/index.d.ts" ] && echo "     ✅ Types partagés générés" || { echo "     ❌ Types manquants"; exit 1; }

# Vérifier que Prettier ignore bien dist/
echo "   - Vérification .prettierignore..."
[ -f "shared/.prettierignore" ] && echo "     ✅ Prettierignore configuré" || log_warning "Prettierignore manquant"

echo ""
echo -e "${GREEN}🎉 Toutes les vérifications CI sont passées !${NC}"
echo ""
echo "📋 Résumé des commandes testées :"
echo "   • pnpm install ✅"
echo "   • pnpm build ✅"
echo "   • pnpm format:check ✅"
echo "   • pnpm lint ✅"
echo "   • pnpm test:unit ✅"
echo "   • pnpm quality ✅"
echo ""
echo "🚀 Le projet est prêt pour la CI/CD !" 