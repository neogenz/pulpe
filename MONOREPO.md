# Guide Turborepo + PNPM Workspace

Ce guide explique notre setup **Turborepo** avec PNPM workspace pour les développeurs découvrant Turborepo.

## 🎯 Pourquoi Turborepo ?

Vous connaissez les monorepos, mais l'orchestration manuelle des builds devient vite pénible :

**Approche classique :**

```bash
# 😫 Ordre manuel + pas de cache + lent
cd shared && npm run build
cd ../frontend && npm run build
cd ../backend-nest && npm run build
```

**Avec Turborepo :**

```bash
# 🚀 Orchestration automatique + cache intelligent + parallélisation
pnpm build  # Turborepo gère tout
```

### Bénéfices concrets

- **⚡ Cache intelligent** : Rebuild seulement ce qui a changé
- **🔄 Dépendances automatiques** : Respect de l'ordre `shared → frontend + backend`
- **⭐ Parallélisation** : Tâches indépendantes en parallèle
- **📊 Visibilité** : Interface TUI pour suivre l'exécution
- **🚀 CI optimisé** : Cache partagé entre développeurs

## 🏗️ Notre setup

```
pulpe-workspace/
├── pnpm-workspace.yaml    # PNPM : Gestion dépendances
├── turbo.json             # Turborepo : Orchestration tâches
├── package.json           # Scripts unifiés
├── shared/                # Package partagé (types, schemas)
├── frontend/              # App Angular
└── backend-nest/          # API NestJS
```

### PNPM Workspace (`pnpm-workspace.yaml`)

```yaml
packages:
  - "frontend" # Projet Angular
  - "shared" # Package commun
  - "backend-nest" # API Backend
```

Dépendances locales avec `workspace:*` :

```json
// frontend/package.json
{
  "dependencies": {
    "@pulpe/shared": "workspace:*" // ← Référence locale automatique
  }
}
```

### Turborepo Configuration (`turbo.json`)

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"], // Attendre que les dépendances se buildent
      "outputs": ["dist/**"] // Cache ces dossiers
    },
    "dev": {
      "cache": false, // Pas de cache pour le dev
      "persistent": true, // Tâche longue (serveurs)
      "dependsOn": ["^build"] // Build shared d'abord
    }
  }
}
```

**Clés importantes :**

- `"dependsOn": ["^build"]` : Attend que les dépendances se buildent
- `"outputs": ["dist/**"]` : Dossiers à mettre en cache
- `"persistent": true` : Pour les serveurs dev (pas d'arrêt automatique)

## 🚀 Commandes orchestrées

### Développement

```bash
# 🔥 Stack complète (recommandé)
pnpm dev
# → Build shared → Lance frontend + backend en parallèle

# 🎯 Développement ciblé
pnpm dev:frontend     # Frontend + shared auto
pnpm dev:backend      # Backend + shared auto
pnpm dev:shared       # Watch mode shared seulement
```

### Build et CI

```bash
# 📦 Build complet avec cache
pnpm build

# 🧪 Tests orchestrés
pnpm test             # Tous les tests
pnpm test:unit        # Tests unitaires
pnpm test:e2e         # Tests end-to-end

# 🔍 Qualité
pnpm lint:fix         # ESLint + corrections
pnpm quality:fix      # Lint + format + type-check
```

## 💡 Workflow développeur

### Setup initial

```bash
git clone <repo>
cd pulpe-workspace
pnpm install          # Installe tout le workspace
pnpm dev              # Lance la stack complète
```

### Développement quotidien

```bash
# Édition dans frontend/ ou backend/
pnpm dev              # Hot reload intelligent

# Ajout/modification dans shared/
# → TypeScript voit les changements immédiatement (alias)
# → Turborepo rebuild shared si nécessaire
# → Frontend/backend se rechargent automatiquement
```

### Avant commit

```bash
pnpm quality:fix      # Fix lint + format
pnpm test             # Validation complète
git add . && git commit
```

## ⚡ Cache intelligent détaillé

### Comment ça marche

Turborepo hashe les **inputs** (fichiers source) et met en cache les **outputs** (dossiers build) :

```bash
# Premier build : 30s
pnpm build

# Aucun changement : ~2s
pnpm build  # → "FULL TURBO" (cache hit)

# Changement dans shared/ seulement
pnpm build  # → Rebuild shared + frontend + backend (affectés)
```

### Gestion du cache

```bash
# Nettoyer le cache local
pnpm clean

# Build sans cache (debug)
pnpm build --force

# Rebuild package spécifique
pnpm build --filter=@pulpe/shared
```

## 🔧 Dépendances et parallélisation

### Graphe de dépendances

```
shared/
  ↓ (dependsOn: ["^build"])
frontend/ + backend/ (en parallèle)
```

Turborepo respecte automatiquement cet ordre et parallélise ce qui peut l'être.

### Scripts avancés

```bash
# Build avec filtre
pnpm build --filter=frontend

# Dev avec filtre
pnpm dev --filter=shared...  # shared + ses dépendants

# Scope par dossier
pnpm build --filter=./frontend
```

## 🔍 Troubleshooting

### Types shared pas synchronisés

```bash
# Force rebuild shared
pnpm build --filter=@pulpe/shared

# Restart TypeScript (IDE)
Cmd+Shift+P > "TypeScript: Restart TS Server"
```

### Cache incohérent

```bash
# Reset complet
pnpm clean && pnpm build

# Debug avec logs
pnpm build --dry-run
```

### Dépendances workspace cassées

```bash
# Réinstallation propre
rm -rf node_modules */node_modules .turbo
pnpm install
```

## 📚 Ressources Turborepo

- **[Turborepo Handbook](https://turbo.build/repo/docs)** : Documentation complète
- **[Task Dependencies](https://turbo.build/repo/docs/core-concepts/monorepos/task-dependencies)** : Configuration avancée
- **[Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)** : Commandes ciblées
- **[Caching](https://turbo.build/repo/docs/core-concepts/caching)** : Optimisation du cache

---

🎯 **TL;DR** : Turborepo = orchestrateur intelligent pour monorepos. PNPM gère les dépendances, Turborepo orchestre les tâches avec cache.
