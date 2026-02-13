# Frontend Pulpe - Angular 21+

Application frontend moderne de gestion de budgets personnels construite avec Angular 21+, Signals, et Tailwind CSS.

## 🚀 Technologies

- **Angular 21+** : Standalone Components, Signals, Control Flow moderne
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
├── core/                    # Services core et cross-cutting concerns
│   ├── analytics/          # Intégration analytics
│   ├── auth/               # Authentification et guards
│   ├── budget/             # API budget
│   ├── budget-template/    # API templates
│   ├── config/             # Configuration applicative
│   ├── demo/               # Mode démo
│   ├── encryption/         # Chiffrement AES-256-GCM
│   ├── routing/            # Routing et title strategy
│   ├── transaction/        # API transactions
│   ├── user-settings/      # Paramètres utilisateur
│   └── ...                 # date, loading, logging, storage, validators, etc.
├── feature/                # Features lazy-loaded
│   ├── auth/               # Connexion
│   ├── welcome/            # Processus d'inscription (onboarding)
│   ├── complete-profile/   # Complétion du profil
│   ├── current-month/      # Budget du mois en cours
│   ├── budget/             # Gestion et historique des budgets
│   ├── budget-templates/   # Gestion des templates
│   ├── settings/           # Paramètres utilisateur
│   ├── legal/              # Pages légales
│   └── maintenance/        # Page de maintenance
├── ui/                     # Composants réutilisables stateless
├── pattern/                # Composants réutilisables stateful
├── layout/                 # Shell applicatif (navigation, about)
├── styles/                 # Styles SCSS globaux et thèmes
└── testing/                # Utilitaires de test
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
pnpm run test                # Tous les tests unitaires
pnpm run test:watch          # Mode watch
pnpm run typecheck           # Vérification des types

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

Les couleurs financières utilisent des CSS custom properties mappées sur les tokens Material 3 :

```css
--pulpe-financial-income    /* Revenus  → mat-sys-tertiary */
--pulpe-financial-expense   /* Dépenses → mat-sys-error */
--pulpe-financial-savings   /* Épargne  → mat-sys-primary */
```

Classes Tailwind : `text-financial-income`, `text-financial-expense`, `text-financial-savings`

## 📱 Features

### 🔐 Authentification

- Login/Logout sécurisé avec Supabase
- Guards pour protection des routes
- Gestion des tokens JWT

### 🏠 Welcome (Onboarding)

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

### 📊 Budgets

- Historique des budgets précédents
- Consultation par mois

### ⚙️ Paramètres

- Configuration du profil utilisateur
- Préférences applicatives

### 🔑 Chiffrement

- Chiffrement client-side AES-256-GCM des montants
- Gestion de la clé de chiffrement

### 🎭 Mode démo

- Exploration complète sans inscription

## 🔧 Configuration

### Environment

La configuration est générée automatiquement depuis les variables d'environnement via `generate-config.ts` :

```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

Variables principales (voir `.env.example` pour la liste complète) :

```env
PUBLIC_ENVIRONMENT=local
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
PUBLIC_BACKEND_API_URL=http://localhost:3000/api/v1
PUBLIC_TURNSTILE_SITE_KEY=0x...
PUBLIC_POSTHOG_API_KEY=phc_...
```

### Angular Configuration

- **Tree-shaking** : Optimisations automatiques
- **Lazy loading** : Features chargées à la demande

## 🌐 Intégrations

### Supabase

- **Auth** : Authentification JWT
- **Database** : PostgreSQL avec RLS
- **Real-time** : Synchronisation en temps réel

### Shared Package

- **Types** : `pulpe-shared` pour cohérence
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

- **[Sourcemaps Upload](./docs/sourcemaps-upload.md)** : Upload des sourcemaps vers PostHog
