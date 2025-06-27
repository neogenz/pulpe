# Pulpe Workspace

Pulpe est une application full-stack de gestion de budgets personnels développée en Suisse. Ce monorepo est géré avec `pnpm`, `turbo` et contient :

- **`backend-nest/`** : API robuste avec NestJS, Bun et Supabase
- **`frontend/`** : Application moderne avec Angular 20+, Signals et Tailwind CSS  
- **`shared/`** : Package de types et schémas partagés (Zod)

## 🚀 Stack Technique

- **Monorepo** : `pnpm` workspace + `turbo` pour l'orchestration
- **Backend** : NestJS 11+, Bun runtime, Supabase (PostgreSQL + Auth), Zod validation
- **Frontend** : Angular 20+, Standalone Components, Signals, Tailwind CSS v4.1, Angular Material, Vitest, Playwright
- **Partagé** : TypeScript strict, Zod schemas, ESM-first
- **Locale** : fr-CH, devise CHF (.-)

## 📋 Prérequis

- **Node.js** (LTS recommandé)
- **pnpm** v8+ (gestionnaire de packages)
- **bun** v1.2+ (runtime backend)
- **Supabase** (compte et projet configuré)

## 🛠️ Installation

1. **Cloner le dépôt**
   ```bash
   git clone <votre-url-de-repo>
   cd pulpe-workspace
   ```

2. **Installer les dépendances**
   ```bash
   pnpm install
   ```

3. **Configurer l'environnement**
   ```bash
   # Backend
   cp backend-nest/.env.example backend-nest/.env
   # Éditer backend-nest/.env avec vos clés Supabase
   ```

## 🚀 Développement

### Démarrage rapide

```bash
# Développement complet (recommandé)
pnpm dev

# Frontend + shared seulement
pnpm dev:frontend-only

# Backend + shared seulement  
pnpm dev:backend-only
```

### Scripts disponibles

| Commande | Description |
|----------|-------------|
| **Développement** |
| `pnpm dev` | Lance tous les services en parallèle |
| `pnpm dev:frontend` | Frontend Angular (http://localhost:4200) |
| `pnpm dev:backend` | Backend NestJS (http://localhost:3000) |
| `pnpm dev:shared` | Watch mode pour le package partagé |
| **Build** |
| `pnpm build` | Build tous les projets |
| `pnpm build:frontend` | Build frontend pour production |
| `pnpm build:backend` | Build backend pour production |
| `pnpm build:shared` | Build package partagé |
| **Tests** |
| `pnpm test` | Tous les tests |
| `pnpm test:unit` | Tests unitaires |
| `pnpm test:integration` | Tests d'intégration |
| `pnpm test:e2e` | Tests end-to-end (Playwright) |
| `pnpm test:vitest` | Tests frontend (Vitest) |
| **Qualité** |
| `pnpm lint` | Analyse ESLint |
| `pnpm lint:fix` | Correction automatique |
| `pnpm format` | Formatage Prettier |
| `pnpm format:check` | Vérification formatage |
| `pnpm quality` | Analyse complète |
| `pnpm quality:fix` | Correction automatique complète |

## 🏗️ Architecture

```
pulpe-workspace/
├── backend-nest/              # API NestJS
│   ├── src/modules/          # Modules métier (auth, budget, transaction...)
│   ├── src/common/           # Guards, interceptors, DTOs
│   └── src/types/            # Types Supabase
├── frontend/                  # App Angular
│   └── projects/webapp/src/
│       ├── app/core/         # Services core (auth, API)
│       ├── app/feature/      # Features lazy-loaded
│       ├── app/ui/           # Composants réutilisables
│       └── app/layout/       # Layouts applicatifs
├── shared/                    # Package partagé
│   ├── schemas.ts            # Schémas Zod
│   └── types.ts              # Types TypeScript
└── scripts/                   # Scripts utilitaires
```

### Règles d'architecture appliquées

- **Feature-based** : Organisation par domaines métier
- **Standalone Components** : Angular 20+ sans NgModules  
- **Signals** : State management réactif
- **Boundary Rules** : Isolation stricte entre features
- **Shared DTOs** : Types cohérents frontend/backend

## 🔧 URLs de développement

- **Frontend** : http://localhost:4200
- **Backend API** : http://localhost:3000/api
- **Swagger** : http://localhost:3000/api/docs
- **Storybook** : *(si configuré)*

## 📚 Documentation détaillée

- **[Backend Architecture](./backend-nest/ARCHITECTURE.md)** : Patterns NestJS, DTOs, validation
- **[Database Guide](./backend-nest/DATABASE.md)** : Supabase, RLS, sécurité
- **[Frontend Tests](./frontend/run-tests.md)** : Stratégie de tests E2E
- **[Workspace Config](./pnpm-workspace-readme.md)** : Configuration monorepo

## 🧪 Tests

### Frontend
- **Vitest** : Tests unitaires ultra-rapides
- **Playwright** : Tests E2E cross-browser
- **Coverage** : Rapport de couverture intégré

### Backend  
- **Bun Test** : Tests intégrés avec TypeScript
- **Supertest** : Tests d'intégration HTTP
- **Performance** : Tests de charge avec métriques

## 📝 Conventions

- **Locale** : fr-CH (français Suisse)
- **Devise** : CHF (.-)
- **Types** : TypeScript strict, pas d'`any`
- **Fonctions** : Max 30 lignes, 5 paramètres
- **Files** : Max 300 lignes
- **Naming** : camelCase, PascalCase selon contexte

## 🚀 Mise en production

```bash
# Build tous les projets
pnpm build

# Tests complets avant déploiement
pnpm quality && pnpm test

# Démarrage production
# Frontend : Servir dist/webapp/
# Backend : cd backend-nest && bun run start:prod
```

## 🤝 Contribution

1. Respecter les règles d'architecture du workspace
2. Tester avant commit : `pnpm quality:fix && pnpm test`
3. Suivre les conventions de nommage TypeScript
4. Documenter les changements majeurs

## 📄 Licence

MIT