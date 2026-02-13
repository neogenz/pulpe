# Backend NestJS - Pulpe Budget API 🚀

API backend moderne pour l'application Pulpe Budget, construite avec NestJS, Bun et Supabase.

## ✨ **Features**

- **🏗️ NestJS Framework** : Architecture moderne avec decorators et dependency injection
- **📚 OpenAPI/Swagger** : Documentation API auto-générée accessible à `/docs`
- **✅ Validation Zod** : Validation robuste via schemas partagés `pulpe-shared`
- **🔐 Supabase Auth** : Authentification JWT + Row Level Security (RLS)
- **🔒 TypeScript Strict** : Type safety complète de la DB aux réponses API
- **📡 DTOs Partagés** : Types cohérents entre frontend et backend
- **🪵 Logging Structuré** : Logs Pino avec correlation IDs
- **⚡ Bun Runtime** : Performance optimisée avec Bun
- **🔑 Chiffrement** : AES-256-GCM pour les montants financiers
- **🎭 Mode Démo** : Exploration complète sans inscription
- **🛡️ Rate Limiting** : Throttling par utilisateur
- **🚧 Mode Maintenance** : Activation sans redéploiement

> 📖 **Pour comprendre l'architecture en détail** : Consultez [ARCHITECTURE.md](./docs/ARCHITECTURE.md)  
> 🗄️ **Pour maîtriser la base de données** : Consultez [DATABASE.md](./docs/DATABASE.md)

## 🚀 **Quick Start**

### Prérequis

- **Node.js** (LTS) + **Bun** v1.2.17+
- **Supabase** projet configuré

### Installation

```bash
# Installer les dépendances
bun install

# Configurer l'environnement
cp .env.example .env
# ✏️ Éditer .env avec vos clés Supabase
```

> 🔧 **Configuration avancée** : Variables d'environnement et setup détaillés dans [DATABASE.md](./docs/DATABASE.md)

### Développement

```bash
# Démarrer en mode développement (avec Supabase local)
bun run dev

# L'API sera disponible sur http://localhost:3000
# Documentation Swagger : http://localhost:3000/docs
```

### Production

```bash
# Build pour production
bun run build

# Démarrer en production
bun run start:prod
```

## 📋 **Scripts Disponibles**

### **Développement**

```bash
bun run dev            # Mode développement avec Supabase local + hot reload
bun run dev:local      # Mode développement avec .env.local + hot reload
bun run start          # Démarrage simple
bun run build          # Build production
bun run start:prod     # Exécution production
```

### **Base de données**

```bash
bun run dump:db              # Export schema SQL
bun run generate-types       # Générer types TypeScript depuis Supabase distant
bun run generate-types:local # Générer types TypeScript depuis Supabase local
```

> 🗄️ **Guide complet base de données** : Schema, RLS, types et sécurité dans [DATABASE.md](./docs/DATABASE.md)

### **Tests**

```bash
bun run test           # Tous les tests
bun run test:unit      # Tests unitaires (services, guards)
bun run test:integration # Tests d'intégration HTTP
bun run test:performance # Tests de performance avec métriques
bun run test:all       # Suite complète (unit + integration + perf)
bun run test:watch     # Mode watch
bun run test:coverage  # Couverture de code
```

> 🧪 **Stratégie de tests détaillée** : Patterns, mocks et bonnes pratiques dans [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

### **Qualité de Code**

```bash
bun run lint           # Analyse ESLint
bun run lint:fix       # Correction automatique ESLint
bun run format         # Formatage Prettier
bun run format:check   # Vérification formatage
bun run quality        # Type-check + Lint + Format check
bun run quality:fix    # Type-check + Lint:fix + Format
```

## 🌐 **Endpoints API**

Tous les endpoints sont préfixés par `/api/v1` :

### **Authentification**

- `GET /api/v1/auth/validate` - Validation token JWT

### **Utilisateurs**

- `GET /api/v1/users/me` - Profil utilisateur
- `PUT /api/v1/users/profile` - Mise à jour profil
- `PUT /api/v1/users/onboarding-completed` - Marquer onboarding terminé
- `GET /api/v1/users/onboarding-status` - Statut onboarding
- `GET /api/v1/users/settings` - Paramètres utilisateur
- `PUT /api/v1/users/settings` - Modifier paramètres
- `DELETE /api/v1/users/account` - Supprimer le compte

### **Budgets**

- `GET /api/v1/budgets` - Liste des budgets
- `POST /api/v1/budgets` - Créer budget
- `GET /api/v1/budgets/export` - Export budgets
- `GET /api/v1/budgets/exists` - Vérifier existence
- `GET /api/v1/budgets/:id` - Budget par ID
- `GET /api/v1/budgets/:id/details` - Détails complets
- `PATCH /api/v1/budgets/:id` - Modifier budget
- `DELETE /api/v1/budgets/:id` - Supprimer budget

### **Budget Lines (Prévisions)**

- `GET /api/v1/budget-lines/budget/:budgetId` - Lignes par budget
- `POST /api/v1/budget-lines` - Créer ligne
- `GET /api/v1/budget-lines/:id` - Ligne par ID
- `PATCH /api/v1/budget-lines/:id` - Modifier ligne
- `POST /api/v1/budget-lines/:id/reset-from-template` - Réinitialiser depuis template
- `POST /api/v1/budget-lines/:id/toggle-check` - Basculer état vérifié
- `POST /api/v1/budget-lines/:id/check-transactions` - Vérifier transactions
- `DELETE /api/v1/budget-lines/:id` - Supprimer ligne

### **Transactions**

- `GET /api/v1/transactions/budget/:budgetId` - Transactions par budget
- `GET /api/v1/transactions/budget-line/:budgetLineId` - Transactions par ligne
- `GET /api/v1/transactions/search` - Recherche de transactions
- `POST /api/v1/transactions` - Créer transaction
- `GET /api/v1/transactions/:id` - Transaction par ID
- `PATCH /api/v1/transactions/:id` - Modifier transaction
- `DELETE /api/v1/transactions/:id` - Supprimer transaction
- `POST /api/v1/transactions/:id/toggle-check` - Basculer état vérifié

### **Templates de Budget**

- `GET /api/v1/budget-templates` - Liste des templates
- `POST /api/v1/budget-templates` - Créer template
- `POST /api/v1/budget-templates/from-onboarding` - Créer depuis onboarding
- `GET /api/v1/budget-templates/:id` - Template par ID
- `GET /api/v1/budget-templates/:id/usage` - Utilisation du template
- `PATCH /api/v1/budget-templates/:id` - Modifier template
- `DELETE /api/v1/budget-templates/:id` - Supprimer template
- `GET /api/v1/budget-templates/:id/lines` - Lignes du template
- `PATCH /api/v1/budget-templates/:id/lines` - Modifier lignes
- `POST /api/v1/budget-templates/:id/lines` - Ajouter ligne
- `POST /api/v1/budget-templates/:id/lines/bulk-operations` - Opérations en lot

### **Chiffrement**

- `GET /api/v1/encryption/salt` - Récupérer le sel
- `POST /api/v1/encryption/validate-key` - Valider la clé client
- `POST /api/v1/encryption/rekey` - Rechiffrer les données
- `POST /api/v1/encryption/setup-recovery` - Configurer la récupération
- `POST /api/v1/encryption/recover` - Récupérer la clé

### **Démo**

- `POST /api/v1/demo/session` - Créer session démo
- `POST /api/v1/demo/cleanup` - Nettoyer sessions démo

### **Debug** (Développement uniquement)

- `GET /api/v1/debug/test-error/:type` - Tester gestion d'erreurs
- `POST /api/v1/debug/test-service-error` - Tester erreur service
- `GET /api/v1/debug/test-log-levels` - Tester niveaux de log

> 📚 **Documentation Swagger** : Interface interactive disponible à `/docs`  
> 🏗️ **Architecture des controllers** : Patterns et bonnes pratiques dans [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## 🏗️ **Architecture Overview**

```
src/
├── modules/              # Modules métier
│   ├── account-deletion/ # Suppression de compte
│   ├── auth/             # Authentification
│   ├── budget/           # Gestion budgets
│   ├── budget-line/      # Lignes de budget (prévisions)
│   ├── budget-template/  # Templates de budgets
│   ├── debug/            # Debug (dev uniquement)
│   ├── demo/             # Mode démo
│   ├── encryption/       # Chiffrement AES-256-GCM
│   ├── supabase/         # Service Supabase
│   ├── transaction/      # Gestion transactions
│   └── user/             # Gestion utilisateurs
├── common/               # Composants transversaux
│   ├── constants/        # Constantes applicatives
│   ├── decorators/       # Decorators personnalisés (@User)
│   ├── dto/              # DTOs de réponse communs
│   ├── exceptions/       # Exceptions métier
│   ├── filters/          # Filtres d'exceptions globales
│   ├── guards/           # Guards d'authentification
│   ├── interceptors/     # Intercepteurs de réponse
│   ├── logger/           # Configuration logging
│   ├── middleware/        # Middleware HTTP
│   ├── services/         # Services transversaux
│   ├── types/            # Types communs
│   └── utils/            # Utilitaires
├── config/               # Configuration environnement
├── database/             # Scripts et helpers DB
├── test/                 # Utilitaires de test
└── types/                # Types Supabase générés
```

> 🎯 **Architecture détaillée** : Patterns NestJS, modules, services et DTOs dans [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## 🔧 **Configuration**

### Variables d'Environnement

```env
# Requis
SUPABASE_URL=votre_url_supabase
SUPABASE_ANON_KEY=votre_clé_anon_supabase
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_supabase
TURNSTILE_SECRET_KEY=votre_clé_turnstile
ENCRYPTION_MASTER_KEY=votre_clé_hex_64_chars

# Optionnel (avec valeurs par défaut)
NODE_ENV=development
PORT=3000

# Optionnel (sans valeur par défaut)
CORS_ORIGIN=http://localhost:4200
MAINTENANCE_MODE=false
IP_BLACKLIST=
DEBUG_HTTP_FULL=false
```

### Endpoints Utiles

- **API** : http://localhost:3000/api/v1
- **Swagger** : http://localhost:3000/docs
- **OpenAPI JSON** : http://localhost:3000/api/openapi
- **Health** : http://localhost:3000/health

> 🔐 **Configuration sécurisée** : Setup Supabase et RLS dans [DATABASE.md](./docs/DATABASE.md)

## 🛠️ **Stack Technique**

- **Runtime** : Bun (JavaScript/TypeScript)
- **Framework** : NestJS 11+ avec TypeScript strict
- **Base de données** : Supabase (PostgreSQL + Auth + RLS)
- **Validation** : Zod schemas depuis `pulpe-shared`
- **Documentation** : OpenAPI/Swagger auto-générée
- **Logging** : Pino avec structured logging
- **Tests** : Bun test intégré + Supertest
- **Qualité** : ESLint + Prettier + TypeScript strict

## 🔍 **Outils Qualité Intégrés**

### **Linting & Formatting**

- **ESLint** : Règles NestJS + TypeScript best practices
- **Prettier** : Formatage automatique du code
- **Configuration VSCode** : Auto-fix et format on save

### **Type Safety**

- **TypeScript Strict** : Mode strict activé progressivement
- **Types Supabase** : Auto-générés depuis la DB
- **Validation Runtime** : Zod pour garantir la cohérence

### **Tests & Performance**

- **Suite de tests complète** : Unitaires, intégration, performance
- **Couverture** : Services 95%+, Controllers 90%+
- **Tests de charge** : Métriques de performance automatiques

> 🎯 **Bonnes pratiques détaillées** : Patterns de code et conventions dans [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## 🔐 **Sécurité**

### **Authentification & Autorisation**

- **JWT Bearer tokens** : Validation avec Supabase Auth
- **Row Level Security (RLS)** : Isolation des données par utilisateur
- **Guards NestJS** : Protection des endpoints
- **Type safety** : Validation complète des données

### **Validation Multi-Couches**

- **Frontend** : Validation UX avec `pulpe-shared`
- **Backend** : Validation métier avec Zod
- **Database** : Contraintes SQL et politiques RLS

> 🛡️ **Sécurité approfondie** : RLS, policies et validation dans [DATABASE.md](./docs/DATABASE.md)

## 📚 **Documentation Détaillée**

| Document                                 | Objectif                  | Contenu                                           |
| ---------------------------------------- | ------------------------- | ------------------------------------------------- |
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | Deep dive architecture    | Patterns NestJS, DTOs, auth, validation, tests    |
| **[DATABASE.md](./docs/DATABASE.md)**         | Deep dive base de données | Supabase, RLS, sécurité, contraintes, performance |
| **[LOGGING.md](./docs/LOGGING.md)**           | Logging structuré         | Pino, correlation IDs, niveaux, sécurité          |

## 🤝 **Contribution**

### **Workflow de développement**

1. **Avant commit** : `bun run quality:fix && bun run test:all`
2. **Architecture** : Suivre les patterns décrits dans [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. **Database** : Respecter les règles RLS de [DATABASE.md](./docs/DATABASE.md)
4. **Types** : Utiliser `pulpe-shared` pour les DTOs REST

### **Standards de code**

- **Controllers** : HTTP uniquement, déléguer aux services
- **Services** : Logique métier, pas d'accès DB direct
- **DTOs** : Utiliser `createZodDto` avec schemas partagés
- **Types** : Supabase types isolés dans backend

> 🏗️ **Patterns détaillés** : Controllers, Services, DTOs et tests dans [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

🎯 **Ready to code!**

- **🚀 Démarrage rapide** : Suivez le Quick Start ci-dessus
- **🏗️ Comprendre l'architecture** : Consultez [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **🗄️ Maîtriser la base de données** : Consultez [DATABASE.md](./docs/DATABASE.md)
