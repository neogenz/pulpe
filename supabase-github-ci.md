# Guide : Configuration de Supabase Local dans GitHub Actions

## 🎯 Objectif

Ce guide vous accompagne pour configurer vos GitHub Actions afin qu'elles utilisent une instance Supabase locale pendant les tests CI/CD, en cohérence avec votre nouveau workflow de développement local.

## 📋 Sommaire

1. [Vue d'ensemble de la solution](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Configuration étape par étape](#configuration-étape-par-étape)
4. [Gestion des environnements](#gestion-des-environnements)
5. [Dépannage](#dépannage)
6. [Optimisations optionnelles](#optimisations)

---

## 🔍 Vue d'ensemble de la solution {#vue-densemble}

### Situation actuelle

- **Local** : Supabase local via Docker (`supabase start`)
- **CI/CD** : Actuellement configuré pour Supabase distant
- **Production** : Supabase distant (à venir)

### Solution proposée (Approche officielle 2025)

Nous allons configurer GitHub Actions pour :

1. Installer Supabase CLI (via `supabase/setup-cli@v1`)
2. Démarrer une instance Supabase locale avec Docker (via `supabase start`)
3. Attendre que l'instance soit prête (health check robuste)
4. Générer les types TypeScript automatiquement
5. Exécuter les tests contre cette instance locale
6. Nettoyer l'instance après les tests

### Avantages

- ✅ **Approche officielle** documentée par Supabase 2025
- ✅ Cohérence avec l'environnement de développement local
- ✅ Tests 100% isolés (chaque PR a sa propre DB)
- ✅ Pas de coûts supplémentaires (pas de projet Supabase de test)
- ✅ Migrations et types testés automatiquement
- ✅ Docker géré automatiquement par Supabase CLI

---

## 📦 Prérequis {#prérequis}

### Dans votre projet

Vérifiez que vous avez :

- ✅ Le dossier `backend-nest/supabase/` avec :
  - `config.toml` ✅ (déjà présent)
  - `migrations/` ✅ (déjà présent)
  - `seed.sql` ✅ (optionnel, déjà présent)

### Variables d'environnement CI

**Configuration dans GitHub Secrets** (recommandé même pour les clés locales) :

1. Allez dans **Settings > Secrets and variables > Actions**
2. Ajoutez ces secrets :

| Nom                               | Valeur                                                                                                                                                                 | Description                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `SUPABASE_LOCAL_URL`              | `http://127.0.0.1:54321`                                                                                                                                               | URL Supabase local                                             |
| `SUPABASE_LOCAL_ANON_KEY`         | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`            | Clé anon standard (publique mais traitée comme secret)         |
| `SUPABASE_LOCAL_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU` | Clé service_role standard (publique mais traitée comme secret) |

> **💡 Pourquoi GitHub Secrets ?** Même si ces clés locales sont publiques, les traiter comme des secrets :
>
> - Maintient la cohérence des pratiques
> - Prépare la migration vers la production
> - Évite les erreurs de manipulation
> - Donne l'exemple à l'équipe

---

## 🚀 Configuration étape par étape {#configuration-étape-par-étape}

### Étape 1 : Configuration des secrets GitHub

1. **Allez dans votre repo GitHub > Settings > Secrets and variables > Actions**
2. **Cliquez sur "New repository secret"**
3. **Ajoutez ces 3 secrets** (valeurs dans le tableau ci-dessus) :
   - `SUPABASE_LOCAL_URL`
   - `SUPABASE_LOCAL_ANON_KEY`
   - `SUPABASE_LOCAL_SERVICE_ROLE_KEY`

### Étape 2 : Créer le fichier d'environnement CI

Créez `.env.ci` dans `backend-nest/` :

```bash
# backend-nest/.env.ci
# Environment for CI/CD with local Supabase
NODE_ENV=test
PORT=3000

# Supabase configuration will be injected from GitHub Secrets
# SUPABASE_URL - injected via workflow
# SUPABASE_ANON_KEY - injected via workflow
# SUPABASE_SERVICE_ROLE_KEY - injected via workflow

# Rate Limiting
THROTTLE_TTL=1000
THROTTLE_LIMIT=100
```

### Étape 3 : Modifier le workflow CI

Mettez à jour `.github/workflows/ci.yml` pour utiliser les secrets :

```yaml
name: 🚀 CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  checks: write
  pull-requests: read

env:
  NODE_VERSION: "22"
  PNPM_VERSION: "10.12.1"
  BUN_VERSION: "1.2.17"

jobs:
  # 📦 INSTALL & CACHE
  install:
    name: 📦 Install Dependencies
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: 📦 Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: 📥 Install dependencies
        run: pnpm install --frozen-lockfile

  # 🗄️ SUPABASE SETUP (Approche officielle 2025)
  supabase-setup:
    name: 🗄️ Setup Supabase Local
    runs-on: ubuntu-latest
    timeout-minutes: 8
    needs: install
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 🗄️ Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: 🐳 Start Supabase Local (Optimisé)
        working-directory: backend-nest
        run: |
          echo "🚀 Starting Supabase local instance..."
          # Exclure les services non nécessaires pour gain de performance
          supabase start --exclude studio,inbucket,imgproxy

          echo "⏳ Health check robuste..."
          timeout=180
          counter=0
          until curl -s http://127.0.0.1:54321/rest/v1/ >/dev/null; do
            if [ $counter -gt $timeout ]; then
              echo "❌ Timeout waiting for Supabase"
              supabase status  # Debug en cas d'échec
              exit 1
            fi
            echo "Waiting for Supabase... ($counter/180s)"
            sleep 1
            counter=$((counter + 1))
          done
          echo "✅ Supabase ready!"

      - name: 🔧 Generate TypeScript Types
        working-directory: backend-nest
        run: |
          echo "📝 Generating TypeScript types from local schema..."
          supabase gen types typescript --local > src/types/database.types.ts
          echo "✅ Types generated"

      - name: 🔧 Setup CI Environment
        working-directory: backend-nest
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_LOCAL_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_ROLE_KEY }}
        run: |
          echo "📝 Creating CI environment file..."
          cp .env.ci .env

          # Inject secrets into .env file
          echo "SUPABASE_URL=${SUPABASE_URL}" >> .env
          echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> .env
          echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" >> .env

          echo "✅ Environment ready"

      - name: 💾 Save Supabase State
        uses: actions/upload-artifact@v4
        with:
          name: supabase-state
          path: |
            backend-nest/.env
            backend-nest/src/types/database.types.ts
            backend-nest/supabase/.temp/
          retention-days: 1

  # 🏗️ BUILD (Modifié pour dépendre de supabase-setup)
  build:
    name: 🏗️ Build Projects
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [install, supabase-setup]
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: 📦 Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: 🗄️ Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: 📥 Download Supabase State
        uses: actions/download-artifact@v4
        with:
          name: supabase-state
          path: backend-nest/

      - name: 🐳 Restore Supabase
        working-directory: backend-nest
        run: |
          supabase start --exclude studio,inbucket,imgproxy

          # Health check rapide pour restore
          timeout=60
          counter=0
          until curl -s http://127.0.0.1:54321/rest/v1/ >/dev/null; do
            if [ $counter -gt $timeout ]; then
              echo "❌ Failed to restore Supabase"
              exit 1
            fi
            sleep 1
            counter=$((counter + 1))
          done
          echo "✅ Supabase restored"

      - name: 📥 Install dependencies
        run: pnpm install --frozen-lockfile

      - name: 🏗️ Build all projects
        run: pnpm build

      - name: 📤 Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            shared/dist/
            frontend/dist/
            backend-nest/dist/
          retention-days: 1

  # 🧪 TESTS UNITAIRES (Modifié pour utiliser Supabase local)
  test-unit:
    name: 🧪 Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: build
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: 📦 Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: 🗄️ Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: 📥 Download Supabase State
        uses: actions/download-artifact@v4
        with:
          name: supabase-state
          path: backend-nest/

      - name: 📥 Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: 🐳 Start Supabase for Tests
        working-directory: backend-nest
        run: |
          supabase start --exclude studio,inbucket,imgproxy

          # Health check pour tests
          timeout=60
          counter=0
          until curl -s http://127.0.0.1:54321/rest/v1/ >/dev/null; do
            if [ $counter -gt $timeout ]; then
              echo "❌ Supabase not ready for tests"
              exit 1
            fi
            sleep 1
            counter=$((counter + 1))
          done
          echo "✅ Supabase ready for tests"

      - name: 📥 Install dependencies
        run: pnpm install --frozen-lockfile

      - name: 🧪 Run unit tests
        run: pnpm test:unit
        env:
          NODE_ENV: test
          SUPABASE_URL: ${{ secrets.SUPABASE_LOCAL_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_ROLE_KEY }}

      - name: 🧹 Cleanup Supabase
        if: always()
        working-directory: backend-nest
        run: supabase stop

  # Les autres jobs (test-e2e, quality, test-performance) suivent le même pattern
  # Ajoutez les étapes Supabase CLI et start/stop comme dans test-unit

  # ✅ SUCCESS JOB (inchangé)
  ci-success:
    name: ✅ CI Success
    runs-on: ubuntu-latest
    timeout-minutes: 1
    needs: [build, test-unit, test-e2e, quality, test-performance]
    if: always()
    steps:
      - name: ✅ Check all jobs
        if: needs.build.result == 'success' && needs.test-unit.result == 'success' && needs.test-e2e.result == 'success' && needs.quality.result == 'success' && needs.test-performance.result == 'success'
        run: echo "🎉 All CI checks passed!"

      - name: ❌ Check failures
        if: needs.build.result != 'success' || needs.test-unit.result != 'success' || needs.test-e2e.result != 'success' || needs.quality.result != 'success' || needs.test-performance.result != 'success'
        run: |
          echo "❌ Some CI checks failed"
          exit 1
```

### Étape 4 : Ajouter les scripts CI dans package.json

Mettez à jour `backend-nest/package.json` avec les bonnes pratiques 2025 :

```json
{
  "scripts": {
    // ... scripts existants ...

    // Scripts CI spécifiques (approche officielle)
    "test:ci": "NODE_ENV=test bun --env-file=.env.ci test",
    "start:ci": "NODE_ENV=test bun --env-file=.env.ci src/main.ts",

    // Scripts Supabase optimisés pour CI
    "supabase:ci:start": "supabase start --exclude studio,inbucket,imgproxy",
    "supabase:ci:stop": "supabase stop",
    "supabase:ci:status": "supabase status",
    "supabase:ci:types": "supabase gen types typescript --local > src/types/database.types.ts",

    // Scripts de debug pour CI
    "supabase:ci:health": "curl -f http://127.0.0.1:54321/rest/v1/ || exit 1",
    "supabase:ci:logs": "docker logs $(docker ps -q --filter 'name=supabase')"
  }
}
```

### Étape 5 : Créer un script de setup CI (optionnel)

Créez `backend-nest/scripts/ci-setup.sh` pour usage local/debug :

```bash
#!/bin/bash
set -e

echo "🚀 Setting up CI environment (2025 best practices)..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Checking Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI version: $(supabase --version)${NC}"

echo -e "${YELLOW}🐳 Starting Supabase local (optimized)...${NC}"
supabase start --exclude studio,inbucket,imgproxy

echo -e "${YELLOW}⏳ Health check with timeout...${NC}"
timeout=120
counter=0
until curl -s http://127.0.0.1:54321/rest/v1/ >/dev/null; do
  if [ $counter -gt $timeout ]; then
    echo -e "${RED}❌ Timeout waiting for Supabase${NC}"
    supabase status
    exit 1
  fi
  echo "Waiting for Supabase... ($counter/${timeout}s)"
  sleep 1
  counter=$((counter + 1))
done

echo -e "${GREEN}✅ Supabase ready!${NC}"

echo -e "${YELLOW}📝 Generating TypeScript types...${NC}"
supabase gen types typescript --local > src/types/database.types.ts

echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"
cp .env.ci .env

echo -e "${GREEN}✅ CI environment ready!${NC}"
```

Rendez le script exécutable :

```bash
chmod +x backend-nest/scripts/ci-setup.sh
```

---

## 🔄 Gestion des environnements {#gestion-des-environnements}

### Structure des fichiers d'environnement

```
backend-nest/
├── .env                 # Ignoré par Git (environnement actuel)
├── .env.example         # Template pour production
├── .env.local           # Dev local avec Supabase local (ignoré)
├── .env.ci              # CI avec Supabase local (commité)
└── .env.production      # Production avec Supabase distant (ignoré)
```

### Mise à jour du .gitignore

```gitignore
# backend-nest/.gitignore
.env
.env.local
.env.production
!.env.example
!.env.ci

# Supabase local
supabase/.temp/
supabase/.branches/
```

### Scripts par environnement

```json
// backend-nest/package.json - Scripts optimisés 2025
{
  "scripts": {
    // Développement local
    "dev:local": "bun run supabase:start && NODE_ENV=development bun --env-file=.env.local --watch src/main.ts",

    // CI/CD (approche officielle)
    "ci:setup": "./scripts/ci-setup.sh",
    "ci:test": "NODE_ENV=test bun --env-file=.env.ci test",
    "ci:health": "curl -f http://127.0.0.1:54321/rest/v1/ || exit 1",

    // Production (future)
    "start:prod": "NODE_ENV=production bun --env-file=.env.production dist/main.js"
  }
}
```

---

## 🐛 Dépannage {#dépannage}

### Problème : Supabase ne démarre pas dans GitHub Actions

**Solution** : Utiliser les logs de debug intégrés

```yaml
- name: 🐳 Start Supabase with Debug
  run: |
    # Approche 2025 : services optimisés + logs
    supabase start --exclude studio,inbucket,imgproxy --debug

    # En cas d'échec, afficher le status pour debug
    if [ $? -ne 0 ]; then
      echo "❌ Supabase failed to start"
      supabase status
      docker ps -a
      exit 1
    fi
```

### Problème : Tests échouent avec "connection refused"

**Solution** : Health check robuste déjà implémenté ✅
Le guide utilise maintenant un health check actif avec timeout configurable :

```bash
timeout=180
counter=0
until curl -s http://127.0.0.1:54321/rest/v1/ >/dev/null; do
  if [ $counter -gt $timeout ]; then
    echo "❌ Timeout waiting for Supabase"
    exit 1
  fi
  sleep 1
  counter=$((counter + 1))
done
```

### Problème : Migrations non appliquées

**Solution** : Les migrations sont automatiquement appliquées ✅
`supabase start` applique automatiquement toutes les migrations du dossier `supabase/migrations/`.

Si besoin de forcer :

```yaml
- name: 📊 Force Apply Migrations
  working-directory: backend-nest
  run: |
    # Reset complet (attention : destructeur)
    supabase db reset
    # Ou appliquer uniquement les nouvelles migrations
    supabase migration up
```

### Problème : Port 54321 déjà utilisé

**Solution** : GitHub Actions runners sont isolés ✅
Ce problème n'arrive généralement pas sur GitHub Actions car chaque runner est isolé.

Si nécessaire, utilisez un port différent :

```toml
# backend-nest/supabase/config.toml
[api]
port = 54330
```

Et mettez à jour les secrets GitHub avec `http://127.0.0.1:54330`.

---

## 🚀 Optimisations implémentées {#optimisations}

### 1. Services exclus pour performance ✅

Le guide utilise `--exclude studio,inbucket,imgproxy` qui permet de gagner ~30-60 secondes :

- `studio` : Interface web non nécessaire en CI
- `inbucket` : Service email de test non requis
- `imgproxy` : Service de transformation d'images non requis

### 2. Health check robuste ✅

Remplace le `sleep 10` par un check actif qui :

- Teste la disponibilité réelle de l'API
- Évite d'attendre inutilement
- Fournit des logs de debug en cas d'échec

### 3. Génération automatique des types ✅

Les types TypeScript sont générés automatiquement via :

```bash
supabase gen types typescript --local > src/types/database.types.ts
```

### 4. Optimisations supplémentaires possibles

Si les temps CI deviennent problématiques :

#### Parallélisation des tests

```yaml
strategy:
  matrix:
    test-suite: [unit, integration, performance]
steps:
  - name: Run ${{ matrix.test-suite }} tests
    run: pnpm test:${{ matrix.test-suite }}
```

#### Cache des images Docker (avancé)

```yaml
- name: 🐳 Cache Docker buildx
  uses: actions/cache@v4
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-buildx-
```

---

## 📝 Checklist de migration

- [ ] Créer `.env.ci` dans `backend-nest/`
- [ ] Mettre à jour `.github/workflows/ci.yml`
- [ ] Ajouter les scripts CI dans `backend-nest/package.json`
- [ ] Créer et rendre exécutable `scripts/ci-setup.sh`
- [ ] Mettre à jour `.gitignore`
- [ ] Tester localement avec `act` (optionnel)
- [ ] Commit et push sur une branche de test
- [ ] Vérifier que les GitHub Actions passent
- [ ] Merger dans la branche principale

---

## 🎯 Prochaines étapes

1. **Test de la configuration** : Créez une PR de test pour valider
2. **Monitoring** : Ajoutez des notifications Slack/Discord pour les échecs CI
3. **Production** : Préparez la configuration pour l'environnement de production
4. **Optimisation** : Implémentez le cache Docker si les builds sont lents

---

## 🚀 Partie 2 : CD - Déploiement Automatique des Migrations Production

### Vue d'ensemble

Cette section décrit le déploiement automatique des migrations Supabase vers la production via GitHub Actions.

### Workflow de déploiement

Le workflow `.github/workflows/supabase-deploy.yml` se déclenche :

1. **Automatiquement** : Push sur `main` avec modifications dans `backend-nest/supabase/migrations/`
2. **Manuellement** : Via GitHub Actions UI → "Run workflow"

Configuration du workflow :

```yaml
name: 🚀 Deploy Supabase Migrations

on:
  push:
    branches: [main]
    paths:
      - "backend-nest/supabase/migrations/**"
  workflow_dispatch: # Déclenchement manuel
```

**Note** : Utilise `yes | supabase db push` pour contourner le prompt interactif (issue connue).

### Configuration des secrets GitHub

Dans **Settings → Secrets and variables → Actions** :

| Secret                   | Description             | Où le trouver                                                                  |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`  | Token d'accès personnel | `supabase login` ou [Dashboard](https://supabase.com/dashboard/account/tokens) |
| `PRODUCTION_PROJECT_ID`  | ID du projet production | URL: `https://supabase.com/dashboard/project/[ID_ICI]`                         |
| `PRODUCTION_DB_PASSWORD` | Mot de passe DB         | Dashboard → Settings → Database → Connection string                            |

### Workflow post-déploiement

Après déploiement automatique, mettre à jour les types localement :

```bash
# 1. Générer les types depuis production
cd backend-nest
bun run generate-types

# 2. Appliquer le formatting
cd ..
pnpm quality:fix

# 3. Commit et push
git add backend-nest/src/types/database.types.ts
git commit -m "chore: update database types after production deployment"
git push
```

### Points d'attention

- Les migrations sont **irréversibles** (notamment DROP COLUMN)
- Lancer la migration locale d'abord :
  - Vérifier que la stack locale tourne et que la migration est dans supabase/migrations/<timestamp>\_nom.sql.
  - Appliquer la migration sur localhost sans reset: supabase migration up (depuis la racine du repo, où se trouve supabase/).
  - Optionnel: si besoin de repartir propre pour retester, utiliser supabase db reset pour drop/rejouer toutes les migrations et seed local.
- Les types doivent être mis à jour manuellement pour respecter le quality gate
- Pas de commit automatique depuis le workflow (par design)

---

## 📚 Ressources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [GitHub Actions avec Supabase](https://supabase.com/docs/guides/cli/github-action)
- [Setup CLI Action](https://github.com/supabase/setup-cli)
- [Docker in GitHub Actions](https://docs.github.com/en/actions/using-containerized-services)
- [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)

---

## 💡 Notes importantes (Mise à jour 2025)

1. **✅ Approche officielle** : Cette configuration suit les recommandations Supabase 2025
2. **🔒 Sécurité** : Secrets GitHub utilisés même pour les clés locales (bonne pratique)
3. **⚡ Performance** : Optimisé à ~2-3 minutes avec les services exclus
4. **💰 Coûts** : Aucun coût supplémentaire (pas de projet Supabase de test)
5. **🐳 Docker** : Géré automatiquement par `supabase start` (transparent)
6. **📊 Types** : Génération automatique des types TypeScript à chaque run
7. **🔧 Limitations** : Runners GitHub (7GB RAM, 14GB stockage) suffisants pour Supabase local

---

_Guide créé le 14/08/2025 - Optimisé avec les bonnes pratiques Supabase 2025 pour le projet Pulpe_
