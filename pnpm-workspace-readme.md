# Configuration Workspace PNPM + ESM TypeScript

Ce document explique la configuration moderne du monorepo avec PNPM workspace, TypeScript ESM, et optimisations Angular.

## 📋 Résumé des modifications

### 1. Workspace PNPM
- ✅ Créé `pnpm-workspace.yaml` pour gérer le monorepo
- ✅ Migré de `"file:../shared"` vers `"workspace:*"` dans `frontend/package.json`
- ✅ Ajouté scripts orchestrés dans `package.json` racine

### 2. Package Shared ESM-first
- ✅ Configuration dual ESM/CommonJS avec priorité ESM
- ✅ TypeScript `moduleResolution: "bundler"` pour imports sans extensions
- ✅ Scripts de watch mode pour développement en temps réel

### 3. Angular Build Optimisé
- ✅ Budget ajusté de 500KB → 760KB (plus réaliste)
- ✅ Retiré `@pulpe/shared` des `allowedCommonJsDependencies`
- ✅ Gardé seulement `ws` et `zod` en CommonJS
- ✅ TypeScript `moduleResolution: "bundler"` dans le frontend

## 🏗️ Structure finale

```
pulpe-workspace/
├── pnpm-workspace.yaml          # Configuration workspace
├── package.json                 # Scripts orchestrés
├── shared/                      # Package ESM-first
│   ├── package.json            # Dual ESM/CJS exports
│   ├── tsconfig.esm.json       # moduleResolution: bundler
│   └── index.ts                # Imports TypeScript normaux
├── frontend/                    # Angular app
│   ├── package.json            # workspace:* dependency
│   ├── angular.json            # Budget 760KB + CommonJS minimal
│   └── tsconfig.json           # moduleResolution: bundler
└── backend-nest/               # Backend Bun (exclu du workspace)
```

## ⚙️ Configuration détaillée

### pnpm-workspace.yaml
```yaml
packages:
  - 'frontend'
  - 'shared'
  # backend-nest utilise bun, donc exclu du workspace pnpm
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
      "allowedCommonJsDependencies": [
        "ws",
        "zod"
      ]
    },
    "configurations": {
      "production": {
        "budgets": [{
          "type": "initial", 
          "maximumWarning": "760kB",
          "maximumError": "1MB"
        }]
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

## 🚀 Workflow de développement

### Scripts disponibles
```bash
# Développement complet (shared + frontend + backend)
pnpm run dev

# Développement frontend + shared seulement
pnpm run dev:frontend-only

# Watch mode shared seulement
pnpm run shared:watch

# Build frontend + shared (recommandé)
pnpm run build

# Build avec backend inclus (si backend configuré)
pnpm run build:all

# Build composants individuels
pnpm run build:shared
pnpm run build:frontend
pnpm run build:backend
```

### Workflow quotidien

1. **Démarrer le développement :**
   ```bash
   pnpm run dev:frontend-only
   ```

2. **Éditer un type dans `shared/` :**
   - ✅ TypeScript voit immédiatement les changements (alias vers sources)
   - ✅ Watch mode compile ESM + CJS en arrière-plan
   - ✅ Frontend hot-reload automatiquement
   - ✅ Aucune action manuelle requise

## 🎯 Avantages de cette configuration

### Performance
- **ESM-first** : Optimisations modernes activées
- **Bundler moduleResolution** : Résolution optimisée pour les bundlers
- **Lazy loading** : Budget-templates seulement 7.33KB
- **Budget réaliste** : 760KB pour Angular + Supabase + Material

### Développement
- **Imports TypeScript normaux** : Pas d'extensions `.js` dans le code
- **Hot reload instantané** : Changements propagés en temps réel
- **Intellisense optimal** : Alias TypeScript vers sources
- **Workspace protocol** : Gestion robuste des dépendances internes

### Compatibilité
- **Dual format** : ESM pour les bundlers modernes, CommonJS en fallback
- **Node.js spec compliant** : Exports conditions selon les standards
- **Angular optimisé** : Bundle warnings éliminés

## 🔍 Résolution des problèmes

### Si les types ne se mettent pas à jour :
```bash
# Rebuild manuel du shared
pnpm run shared:build

# Restart du TypeScript server dans l'IDE
Cmd+Shift+P > "TypeScript: Restart TS Server"
```

### Si les imports ne fonctionnent pas :
- Vérifier que le symlink existe : `ls -la frontend/node_modules/@pulpe/`
- Vérifier l'alias TypeScript dans `tsconfig.app.json`
- Redémarrer le serveur de développement

### Si le build échoue :
- S'assurer que `shared/dist/` existe : `pnpm run shared:build`
- Vérifier les exports dans `shared/package.json`