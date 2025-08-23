# Backend NestJS - Pulpe Budget API 🚀

API backend moderne pour l'application Pulpe Budget, construite avec NestJS, Bun et Supabase.

## ✨ **Features**

- **🏗️ NestJS Framework** : Architecture moderne avec decorators et dependency injection
- **📚 OpenAPI/Swagger** : Documentation API auto-générée accessible à `/docs`
- **✅ Validation Zod** : Validation robuste via schemas partagés `@pulpe/shared`
- **🔐 Supabase Auth** : Authentification JWT + Row Level Security (RLS)
- **🔒 TypeScript Strict** : Type safety complète de la DB aux réponses API
- **📡 DTOs Partagés** : Types cohérents entre frontend et backend
- **🪵 Logging Structuré** : Logs Pino avec correlation IDs
- **⚡ Bun Runtime** : Performance optimisée avec Bun

> 📖 **Pour comprendre l'architecture en détail** : Consultez [ARCHITECTURE.md](./ARCHITECTURE.md)  
> 🗄️ **Pour maîtriser la base de données** : Consultez [DATABASE.md](./DATABASE.md)

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

> 🔧 **Configuration avancée** : Variables d'environnement et setup détaillés dans [DATABASE.md](./DATABASE.md)

### Développement

```bash
# Démarrer en mode développement
bun run start:dev

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
bun run start:dev      # Mode développement avec hot reload
bun run start          # Démarrage simple
bun run build          # Build production
bun run start:prod     # Exécution production
```

### **Base de données**

```bash
bun run dump:db        # Export schema SQL
bun run generate-types # Générer types TypeScript depuis Supabase
```

> 🗄️ **Guide complet base de données** : Schema, RLS, types et sécurité dans [DATABASE.md](./DATABASE.md)

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

> 🧪 **Stratégie de tests détaillée** : Patterns, mocks et bonnes pratiques dans [ARCHITECTURE.md](./ARCHITECTURE.md)

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

Tous les endpoints sont préfixés par `/api` :

### **Authentification**

- `GET /api/auth/validate` - Validation token JWT

### **Utilisateurs**

- `GET /api/users/me` - Profil utilisateur
- `PUT /api/users/profile` - Mise à jour profil
- `GET /api/users/public-info` - Informations publiques
- `PUT /api/users/onboarding-completed` - Marquer onboarding terminé

### **Budgets**

- `GET /api/budgets` - Liste des budgets
- `POST /api/budgets` - Créer budget
- `GET /api/budgets/:id` - Budget par ID
- `PUT /api/budgets/:id` - Modifier budget
- `DELETE /api/budgets/:id` - Supprimer budget
- `POST /api/budgets/from-onboarding` - Créer budget depuis onboarding

### **Transactions**

- `GET /api/transactions/budget/:budgetId` - Transactions par budget
- `POST /api/transactions` - Créer transaction
- `GET /api/transactions/:id` - Transaction par ID
- `PUT /api/transactions/:id` - Modifier transaction
- `DELETE /api/transactions/:id` - Supprimer transaction

### **Templates de Budget**

- `GET /api/budget-templates` - Liste des templates
- `POST /api/budget-templates` - Créer template
- `GET /api/budget-templates/:id` - Template par ID
- `PUT /api/budget-templates/:id` - Modifier template
- `DELETE /api/budget-templates/:id` - Supprimer template
- `GET /api/budget-templates/:id/transactions` - Transactions du template

### **Debug** (Développement uniquement)

- `GET /api/debug/health` - Health check

> 📚 **Documentation Swagger** : Interface interactive disponible à `/docs`  
> 🏗️ **Architecture des controllers** : Patterns et bonnes pratiques dans [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🏗️ **Architecture Overview**

```
src/
├── modules/           # Modules métier
│   ├── auth/         # Authentification
│   ├── budget/       # Gestion budgets
│   ├── transaction/  # Gestion transactions
│   ├── budget-template/ # Templates de budgets
│   ├── user/         # Gestion utilisateurs
│   └── supabase/     # Service Supabase
├── common/           # Composants transversaux
│   ├── guards/       # Guards d'authentification
│   ├── decorators/   # Decorators personnalisés (@User)
│   ├── interceptors/ # Intercepteurs de réponse
│   ├── filters/      # Filtres d'exceptions globales
│   └── dto/          # DTOs de réponse communs
├── types/            # Types Supabase
└── config/           # Configuration environnement
```

> 🎯 **Architecture détaillée** : Patterns NestJS, modules, services et DTOs dans [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔧 **Configuration**

### Variables d'Environnement

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=votre_url_supabase
SUPABASE_ANON_KEY=votre_clé_anon_supabase
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_supabase
```

### Endpoints Utiles

- **API** : http://localhost:3000/api/v1
- **Swagger** : http://localhost:3000/docs
- **OpenAPI JSON** : http://localhost:3000/api/openapi
- **Health** : http://localhost:3000/health

> 🔐 **Configuration sécurisée** : Setup Supabase et RLS dans [DATABASE.md](./DATABASE.md)

## 🛠️ **Stack Technique**

- **Runtime** : Bun (JavaScript/TypeScript)
- **Framework** : NestJS 11+ avec TypeScript strict
- **Base de données** : Supabase (PostgreSQL + Auth + RLS)
- **Validation** : Zod schemas depuis `@pulpe/shared`
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

> 🎯 **Bonnes pratiques détaillées** : Patterns de code et conventions dans [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔐 **Sécurité**

### **Authentification & Autorisation**

- **JWT Bearer tokens** : Validation avec Supabase Auth
- **Row Level Security (RLS)** : Isolation des données par utilisateur
- **Guards NestJS** : Protection des endpoints
- **Type safety** : Validation complète des données

### **Validation Multi-Couches**

- **Frontend** : Validation UX avec `@pulpe/shared`
- **Backend** : Validation métier avec Zod
- **Database** : Contraintes SQL et politiques RLS

> 🛡️ **Sécurité approfondie** : RLS, policies et validation dans [DATABASE.md](./DATABASE.md)

## 📚 **Documentation Détaillée**

| Document                                 | Objectif                  | Contenu                                           |
| ---------------------------------------- | ------------------------- | ------------------------------------------------- |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Deep dive architecture    | Patterns NestJS, DTOs, auth, validation, tests    |
| **[DATABASE.md](./DATABASE.md)**         | Deep dive base de données | Supabase, RLS, sécurité, contraintes, performance |

## 🤝 **Contribution**

### **Workflow de développement**

1. **Avant commit** : `bun run quality:fix && bun run test:all`
2. **Architecture** : Suivre les patterns décrits dans [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Database** : Respecter les règles RLS de [DATABASE.md](./DATABASE.md)
4. **Types** : Utiliser `@pulpe/shared` pour les DTOs REST

### **Standards de code**

- **Controllers** : HTTP uniquement, déléguer aux services
- **Services** : Logique métier, pas d'accès DB direct
- **DTOs** : Utiliser `createZodDto` avec schemas partagés
- **Types** : Supabase types isolés dans backend

> 🏗️ **Patterns détaillés** : Controllers, Services, DTOs et tests dans [ARCHITECTURE.md](./ARCHITECTURE.md)

---

🎯 **Ready to code!**

- **🚀 Démarrage rapide** : Suivez le Quick Start ci-dessus
- **🏗️ Comprendre l'architecture** : Consultez [ARCHITECTURE.md](./ARCHITECTURE.md)
- **🗄️ Maîtriser la base de données** : Consultez [DATABASE.md](./DATABASE.md)
