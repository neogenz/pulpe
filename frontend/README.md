# Frontend Pulpe - Angular 20+

Application frontend moderne de gestion de budgets personnels construite avec Angular 20+, Signals, et Tailwind CSS.

## 🚀 Technologies

- **Angular 20+** : Standalone Components, Signals, Control Flow moderne
- **UI/UX** : Angular Material + Tailwind CSS v4.1
- **State** : Angular Signals pour la réactivité
- **Routing** : Lazy loading avec `withComponentInputBinding`
- **Forms** : Reactive Forms avec types stricts
- **Tests** : Vitest (unitaires) + Playwright (E2E)
- **Build** : Angular CLI avec optimisations de bundle

## 🏗️ Architecture

### Structure des dossiers

```
src/app/
├── core/                    # Services core (auth, API, routing)
│   ├── auth/               # Authentification et guards
│   ├── budget/             # API budget
│   └── transaction/        # API transactions
├── feature/                # Features lazy-loaded
│   ├── auth/               # Connexion
│   ├── onboarding/         # Processus d'inscription
│   ├── current-month/      # Budget du mois en cours
│   ├── budget-templates/   # Gestion des templates
│   └── other-months/       # Historique des budgets
├── ui/                     # Composants réutilisables
│   ├── breadcrumb/         # Navigation fil d'Ariane
│   └── financial-summary/  # Résumés financiers
├── layout/                 # Layouts applicatifs
│   ├── main-layout.ts      # Layout principal avec navigation
│   └── navigation-menu.ts  # Menu de navigation
└── shared/                 # Utilitaires partagés
```

### Règles d'architecture

- **Features isolées** : Aucun import entre features
- **Lazy loading** : Toutes les features sont lazy-loaded
- **UI générique** : Composants réutilisables sans logique métier
- **Core services** : State management centralisé
- **Signals-first** : Réactivité avec Angular Signals

## 🛠️ Développement

### Prérequis

```bash
# Depuis la racine du workspace
pnpm install
```

### Commandes de développement

```bash
# Démarrage rapide
pnpm run start                # ng serve --open

# Développement
pnpm run dev                  # ng serve
pnpm run watch               # ng build --watch

# Build
pnpm run build               # ng build
```

### Tests

```bash
# Tests unitaires (Vitest)
pnpm run test:vitest:ui         # Vitest UI
pnpm run test:vitest:run     # Run tests

# Tests E2E (Playwright)
pnpm run test:e2e            # Tests E2E
pnpm run test:e2e:ui         # Mode interactif
pnpm run test:e2e:headed     # Mode visible
pnpm run test:e2e:debug      # Mode debug
pnpm run test:e2e:codegen    # Génération de tests
```

### Qualité de code

```bash
# Linting
pnpm run lint                # ESLint analyse

# Formatage
pnpm run format              # Prettier format
pnpm run format:check        # Vérification

# Analyse des dépendances
pnpm run analyze:deps        # Graphiques de dépendances
pnpm run analyze             # Bundle analyzer
pnpm run deps:circular       # Vérifie les dépendances circulaires avec Madge (échoue si cycles)
```

## 🧪 Tests

### Structure des tests

```
e2e/
├── tests/
│   ├── critical-path/      # Tests critiques (auth, navigation)
│   └── features/           # Tests par feature
├── pages/                  # Page Object Models
├── fixtures/               # Données de test
└── utils/                  # Utilitaires de test
```

### Stratégie de tests

- **E2E critiques** : Authentification, navigation principale
- **E2E features** : Workflows utilisateur complets
- **Unit Vitest** : Composants et services isolés
- **Coverage** : Rapport de couverture automatique

## 🎨 UI/UX

### Design System

- **Angular Material** : Composants base
- **Tailwind CSS v4.1** : Utility-first styling
- **Thèmes** : Dark/Light mode support
- **Responsive** : Mobile-first approach
- **Accessibilité** : ARIA + guidelines Material

### Couleurs financières

```scss
// Variables Sass custom
$income-color: #4caf50; // Vert pour revenus
$expense-color: #f44336; // Rouge pour dépenses
$savings-color: #2196f3; // Bleu pour épargne
```

## 📱 Features

### 🔐 Authentification

- Login/Logout sécurisé avec Supabase
- Guards pour protection des routes
- Gestion des tokens JWT

### 🏠 Onboarding

- Processus guidé pour nouveaux utilisateurs
- Collecte d'informations financières de base
- Création du premier budget

### 💰 Budget du mois en cours

- Vue d'ensemble financière
- Suivi revenus/dépenses en temps réel
- Ajout rapide de dépenses

### 📋 Templates de budget

- Création et gestion de modèles
- Duplication pour nouveaux mois
- Gestion des transactions récurrentes

### 📊 Autres mois

- Historique des budgets précédents
- Comparaison entre périodes
- Analyse des tendances

## 🔧 Configuration

### Environment

```typescript
// environment.ts
export const environment = {
  production: false,
  supabaseUrl: "your-supabase-url",
  supabaseAnonKey: "your-anon-key",
};
```

### Angular Configuration

- **Bundle budgets** : 760KB warning, 1MB error
- **Tree-shaking** : Optimisations automatiques
- **Lazy loading** : Features chargées à la demande
- **PWA ready** : Configuration Service Worker

## 🌐 Intégrations

### Supabase

- **Auth** : Authentification JWT
- **Database** : PostgreSQL avec RLS
- **Real-time** : Synchronisation en temps réel

### Shared Package

- **Types** : `@pulpe/shared` pour cohérence
- **Validation** : Schemas Zod partagés
- **DTOs** : Interfaces communes frontend/backend

## 📈 Performance

### Optimisations

- **OnPush** : Change detection optimisée
- **Lazy loading** : Routes et composants
- **Signals** : Réactivité fine-grain
- **Bundle splitting** : Chunks automatiques

### Métriques

- **Core bundle** : ~300KB
- **Feature chunks** : 5-15KB chacune
- **Lighthouse** : 90+ performance score
- **LCP** : < 2.5s

## 🚀 Déploiement

```bash
# Build production
pnpm run build

# Fichiers générés dans dist/webapp/
# Servir avec serveur HTTP statique
# Variables d'environnement configurées au build
```

## 📚 Documentation

- **[Run Tests Guide](./run-tests.md)** : Guide complet des tests
- **[TODOs](./TODO.md)** : Améliorations prévues
- **[Turborepo Guide](../MONOREPO.md)** : Guide Turborepo + PNPM workspace
