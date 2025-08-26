#!/bin/bash

# Script intelligent pour installer pnpm avec fallbacks multiples
# Gère tous les cas d'erreur NPM registry (403, 429, etc.)

set -euo pipefail

PNPM_VERSION="${1:-10.12.1}"
CACHE_DIR="$HOME/setup-pnpm"

echo "🚀 Smart pnpm setup with multiple fallbacks"
echo "Target version: $PNPM_VERSION"

# Fonction pour vérifier si pnpm fonctionne
verify_pnpm() {
    if command -v pnpm >/dev/null 2>&1; then
        local version=$(pnpm --version 2>/dev/null || echo "unknown")
        echo "✅ pnpm found: $version"
        return 0
    fi
    return 1
}

# FALLBACK 1: Vérifier si pnpm existe déjà
echo ""
echo "🔍 FALLBACK 1: Checking existing pnpm..."
if verify_pnpm; then
    echo "✅ Using existing pnpm installation"
    exit 0
fi

# FALLBACK 2: Utiliser le cache s'il existe
echo ""
echo "💾 FALLBACK 2: Checking cache..."
if [ -d "$CACHE_DIR" ] && [ -f "$CACHE_DIR/pnpm" ]; then
    echo "✅ Found cached pnpm binary"
    export PATH="$CACHE_DIR:$PATH"
    if verify_pnpm; then
        echo "✅ Using cached pnpm"
        exit 0
    else
        echo "⚠️  Cached pnpm not working, removing cache"
        rm -rf "$CACHE_DIR"
    fi
fi

# FALLBACK 3: Installation via get.pnpm.io (évite NPM registry)
echo ""
echo "🌐 FALLBACK 3: Installing via get.pnpm.io..."
if curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION="$PNPM_VERSION" sh -; then
    # Ajouter au PATH
    export PATH="$HOME/.local/share/pnpm:$PATH"
    if verify_pnpm; then
        echo "✅ Successfully installed pnpm via get.pnpm.io"
        # Créer un cache pour les autres jobs
        mkdir -p "$CACHE_DIR"
        cp "$HOME/.local/share/pnpm/pnpm" "$CACHE_DIR/" 2>/dev/null || true
        exit 0
    fi
fi
echo "⚠️  get.pnpm.io installation failed"

# FALLBACK 4: pnpm/action-setup standalone (peut échouer à cause de NPM)
echo ""
echo "📦 FALLBACK 4: Trying standalone installation..."
if mkdir -p "$CACHE_DIR" && cd "$CACHE_DIR"; then
    # Simuler ce que fait pnpm/action-setup standalone
    if npm install @pnpm/exe@"$PNPM_VERSION" 2>/dev/null; then
        if [ -f "node_modules/.bin/pnpm" ]; then
            cp node_modules/.bin/pnpm ./pnpm 2>/dev/null || true
            chmod +x ./pnpm 2>/dev/null || true
            export PATH="$CACHE_DIR:$PATH"
            if verify_pnpm; then
                echo "✅ Successfully installed pnpm standalone"
                exit 0
            fi
        fi
    fi
fi
echo "⚠️  Standalone installation failed"

# FALLBACK 5: Installation via npm global (dernier recours)
echo ""
echo "🔧 FALLBACK 5: Installing via npm global..."
if npm install -g pnpm@"$PNPM_VERSION" 2>/dev/null; then
    if verify_pnpm; then
        echo "✅ Successfully installed pnpm via npm global"
        exit 0
    fi
fi
echo "⚠️  npm global installation failed"

# FALLBACK 6: GitHub releases direct (sans NPM)
echo ""
echo "🐙 FALLBACK 6: Installing from GitHub releases..."
case "$(uname -s)" in
    Linux)  PLATFORM="linux";;
    Darwin) PLATFORM="macos";;
    *)      PLATFORM="linux";;
esac

DOWNLOAD_URL="https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-${PLATFORM}-x64"

if curl -fsSL "$DOWNLOAD_URL" -o "$CACHE_DIR/pnpm" && chmod +x "$CACHE_DIR/pnpm"; then
    export PATH="$CACHE_DIR:$PATH"
    if verify_pnpm; then
        echo "✅ Successfully installed pnpm from GitHub releases"
        exit 0
    fi
fi
echo "⚠️  GitHub releases installation failed"

# Si tout échoue
echo ""
echo "❌ All pnpm installation methods failed!"
echo "This may be due to NPM registry restrictions or network issues."
echo "Available fallbacks tried:"
echo "  1. ✅ Existing installation check"
echo "  2. 💾 Cache restore"  
echo "  3. 🌐 get.pnpm.io"
echo "  4. 📦 Standalone @pnpm/exe"
echo "  5. 🔧 npm global"
echo "  6. 🐙 GitHub releases"
exit 1