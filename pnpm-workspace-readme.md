# Configuration Workspace PNPM + Turborepo + ESM TypeScript

Ce document explique la configuration moderne du monorepo avec PNPM workspace, **Turborepo pour l'orchestration**, TypeScript ESM, et optimisations Angular.

## 📋 Résumé des modifications

### 1. Workspace PNPM + Turborepo

- ✅ Créé `pnpm-workspace.yaml` pour gérer le monorepo
- ✅ **Ajouté `turbo.json` pour l'orchestration des tâches**
- ✅ Migré de `"file:../shared"` vers `"workspace:*"` dans `frontend/package.json`
- ✅ **Scripts orchestrés via Turborepo dans `package.json` racine**

### 2. Package Shared ESM-first

- ✅ Configuration dual ESM/CommonJS avec priorité ESM
- ✅ TypeScript `moduleResolution: "bundler"` pour imports sans extensions
- ✅ **Watch mode géré par Turborepo avec cache intelligent**

### 3. Angular Build Optimisé

- ✅ Budget ajusté de 500KB → 760KB (plus réaliste)
- ✅ Retiré `@pulpe/shared` des `allowedCommonJsDependencies`
- ✅ Gardé seulement `ws` et `zod` en CommonJS
- ✅ TypeScript `moduleResolution: "bundler"` dans le frontend

## 🏗️ Structure finale

```
pulpe-workspace/
├── pnpm-workspace.yaml          # Configuration workspace
├── turbo.json                   # 🚀 Configuration Turborepo
├── package.json                 # Scripts Turborepo
├── shared/                      # Package ESM-first
│   ├── package.json            # Dual ESM/CJS exports
│   ├── tsconfig.esm.json       # moduleResolution: bundler
│   └── index.ts                # Imports TypeScript normaux
├── frontend/                    # Angular app
│   ├── package.json            # workspace:* dependency
│   ├── angular.json            # Budget 760KB + CommonJS minimal
│   └── tsconfig.json           # moduleResolution: bundler
└── backend-nest/               # Backend Bun (inclus dans workspace)
```

## ⚙️ Configuration détaillée

### pnpm-workspace.yaml

```yaml
packages:
  - "frontend"
  - "shared"
  - "backend-nest" # Maintenant inclus dans le workspace
```

### turbo.json - 🚀 **NOUVEAU : Orchestration Turborepo**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**", "test-results/**"]
    }
  }
}
```

### shared/package.json

```json
{
  "name": "@pulpe/shared",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/cjs/index.d.ts",
        "default": "./dist/cjs/index.js"
      },
      "default": "./dist/esm/index.js"
    }
  }
}
```

### shared/tsconfig.esm.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "./dist/esm"
  }
}
```

### frontend/package.json

```json
{
  "dependencies": {
    "@pulpe/shared": "workspace:*"
  }
}
```

### frontend/angular.json

```json
{
  "build": {
    "options": {
      "allowedCommonJsDependencies": ["ws", "zod"]
    },
    "configurations": {
      "production": {
        "budgets": [
          {
            "type": "initial",
            "maximumWarning": "760kB",
            "maximumError": "1MB"
          }
        ]
      }
    }
  }
}
```

### frontend/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler"
  }
}
```

### frontend/projects/webapp/tsconfig.app.json

```json
{
  "compilerOptions": {
    "paths": {
      "@pulpe/shared": ["../../../shared/index.ts"]
    }
  }
}
```

## 🚀 Workflow de développement avec Turborepo

### Scripts disponibles

```bash
# 🚀 Développement complet (shared + frontend + backend)
pnpm dev

# 🎯 Développement ciblé avec filtres Turborepo
pnpm dev:frontend        # Frontend seulement
pnpm dev:backend         # Backend seulement
pnpm dev:shared          # Shared en watch mode

# 📦 Build avec cache intelligent Turborepo
pnpm build               # Build tous les projets
pnpm build:shared        # Build shared seulement
pnpm build:frontend      # Build frontend seulement
pnpm build:backend       # Build backend seulement

# 🧪 Tests orchestrés
pnpm test                # Tous les tests
pnpm test:unit           # Tests unitaires
pnpm test:integration    # Tests d'intégration
pnpm test:e2e           # Tests end-to-end

# 🔍 Qualité de code
pnpm lint               # ESLint sur tous les projets
pnpm lint:fix           # Correction automatique
pnpm format             # Prettier sur tous les projets
pnpm quality            # Analyse complète (lint + format + type-check)
```

### Workflow quotidien

1. **Démarrer le développement complet :**

   ```bash
   pnpm dev  # Lance frontend + backend + shared en parallèle
   ```

2. **Développement frontend seulement :**

   ```bash
   pnpm dev:frontend  # Turborepo build shared puis lance frontend
   ```

3. **Éditer un type dans `shared/` :**
   - ✅ TypeScript voit immédiatement les changements (alias vers sources)
   - ✅ **Turborepo détecte les changements et rebuild automatiquement**
   - ✅ Frontend hot-reload automatiquement
   - ✅ **Cache intelligent : rebuild seulement si nécessaire**

## 🎯 Avantages de Turborepo

### Performance

- **Cache intelligent** : Turborepo cache les résultats des tâches
- **Exécution parallèle** : Tâches indépendantes en parallèle
- **Filtres granulaires** : `--filter=@pulpe/shared` pour cibler
- **Dépendances automatiques** : `dependsOn: ["^build"]` respecté

### Développement

- **Hot reload optimisé** : Rebuild seulement les projets impactés
- **UI moderne** : Interface TUI pour suivre les tâches
- **Logs structurés** : Sortie claire par projet
- **Watch mode intelligent** : Détection fine des changements

### Monorepo

- **Orchestration centralisée** : Une seule config `turbo.json`
- **Scalabilité** : Ajout facile de nouveaux projets
- **CI optimisé** : Cache partagé entre développeurs
- **Reproductibilité** : Builds déterministes

## 🔍 Résolution des problèmes

### Si les types ne se mettent pas à jour :

```bash
# Force rebuild du shared
turbo build --filter=@pulpe/shared --force

# Restart du TypeScript server dans l'IDE
Cmd+Shift+P > "TypeScript: Restart TS Server"
```

### Si le cache Turborepo pose problème :

```bash
# Nettoyer le cache Turborepo
turbo clean

# Rebuild complet sans cache
turbo build --force
```

### Si les imports ne fonctionnent pas :

- Vérifier que le symlink existe : `ls -la frontend/node_modules/@pulpe/`
- Vérifier l'alias TypeScript dans `tsconfig.app.json`
- **Vérifier que Turborepo a bien build shared** : `turbo build --filter=@pulpe/shared`

### Si le build échoue :

- S'assurer que les dépendances sont respectées dans `turbo.json`
- Vérifier les exports dans `shared/package.json`
- **Utiliser `--force` pour ignorer le cache temporairement**

## 📚 Ressources Turborepo

- **[Documentation officielle](https://turbo.build/repo/docs)**
- **[Guide des filtres](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)**
- **[Configuration des tâches](https://turbo.build/repo/docs/core-concepts/monorepos/task-dependencies)**
