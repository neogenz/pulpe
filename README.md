<div align="center">

<img src="frontend/projects/webapp/public/logo.svg" alt="Pulpe" width="120" />

# Pulpe

**Tu sais ce qu'il te reste ? Pulpe, oui.**

Application de planification budgétaire personnelle pour la Suisse.
Planifie ton année, maîtrise tes dépenses, mois après mois.

[![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular&logoColor=white)](https://angular.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Zod](https://img.shields.io/badge/Zod-4-3068b7?logo=zod&logoColor=white)](https://zod.dev)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Web** · [pulpe.app](https://pulpe.app) · **iOS** · [App Store](https://apps.apple.com/app/pulpe) · **Code** · [GitHub](https://github.com/neogenz/pulpe)

</div>

---

## Table des matières

- [À propos](#à-propos)
- [Plateformes](#plateformes)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Développement](#développement)
- [Tests](#tests)
- [Documentation](#documentation)

## À propos

Pulpe est une application de gestion de budgets personnels développée en Suisse. Contrairement aux apps de suivi classiques, Pulpe mise sur la **planification** : tu crées un template mensuel avec tes revenus, charges fixes et objectifs d'épargne, puis tu génères ton budget annuel en quelques minutes.

### Philosophie

| Principe | Description |
|----------|-------------|
| **Planification > Suivi** | Anticiper plutôt que réagir |
| **Simplicité > Exhaustivité** | KISS & YAGNI, une seule devise (CHF) |
| **Sérénité > Contrôle** | Savoir ce qu'il reste à dépenser, sans prise de tête |

### Fonctionnalités clés

- **Templates mensuels** — crée une structure réutilisable (revenus, charges, épargne)
- **Planification annuelle** — génère 12 budgets en un clic depuis un template
- **Suivi du reste à dépenser** — saisie rapide des dépenses, solde visible en temps réel
- **Report automatique** — l'excédent ou déficit se propage de mois en mois
- **Alertes dépassement** — notifications à 80%, 90% et 100% du budget
- **Mode démo** — exploration complète du produit sans inscription

<!-- TODO: Ajouter une capture d'écran du dashboard ici -->
<!-- <img src="docs/screenshot-dashboard.png" alt="Dashboard Pulpe" width="720" /> -->

## Plateformes

| Plateforme | Statut | Lien |
|------------|--------|------|
| Web | Disponible | [pulpe.app](https://pulpe.app) |
| iOS | Disponible | [App Store](https://apps.apple.com/app/pulpe) |
| Android | Prévu | — |

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | Angular 21, Signals, Material 21, Tailwind CSS v4 |
| **Backend** | NestJS 11, Bun, Supabase (PostgreSQL + Auth + RLS) |
| **iOS** | SwiftUI, WidgetKit |
| **Landing** | Next.js, Tailwind CSS v4 |
| **Partagé** | TypeScript strict, Zod 4 |
| **Orchestration** | pnpm workspaces + Turborepo |

## Architecture

```
pulpe-workspace/
├── frontend/                  # App Angular
│   └── projects/webapp/src/
│       ├── app/core/         # Services (auth, API, routing)
│       ├── app/feature/      # Features lazy-loaded par domaine
│       ├── app/ui/           # Composants stateless réutilisables
│       ├── app/pattern/      # Composants stateful réutilisables
│       └── app/layout/       # Shell applicatif
├── backend-nest/              # API NestJS
│   ├── src/modules/          # Modules métier (auth, budget, transaction…)
│   ├── src/common/           # Guards, interceptors, DTOs
│   └── src/types/            # Types Supabase générés
├── ios/                       # App iOS native
│   ├── Pulpe/                # Code source SwiftUI
│   └── PulpeWidget/          # Widget iOS
├── landing/                   # Landing page Next.js
├── shared/                    # Schémas Zod & types TypeScript
└── scripts/                   # Scripts utilitaires
```

## Démarrage rapide

```bash
# Cloner et installer
git clone https://github.com/neogenz/pulpe.git
cd pulpe-workspace
pnpm install

# Configurer le backend
cp backend-nest/.env.example backend-nest/.env
# Éditer backend-nest/.env avec vos clés Supabase

# Lancer le projet
pnpm dev
```

> **Prérequis** : Node.js LTS, pnpm 10+, Bun 1.2+, Supabase (compte configuré)

## Développement

```bash
# Full stack
pnpm dev                  # Tous les services

# Par package
pnpm dev:frontend         # Frontend seul
pnpm dev:backend          # Backend seul
pnpm dev:frontend-only    # Frontend + shared
pnpm dev:backend-only     # Backend + shared

# Qualité (avant chaque commit)
pnpm quality              # Type-check + lint + format
pnpm lint:fix             # Corrections automatiques

# Build
pnpm build                # Build tous les projets
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000/api |
| Swagger | http://localhost:3000/api/docs |

## Tests

| Type | Outil | Commande |
|------|-------|----------|
| Unitaires frontend | Vitest | `cd frontend && pnpm test` |
| Unitaires backend | Bun Test | `cd backend-nest && bun test` |
| E2E | Playwright | `pnpm test:e2e` |

## Production

```bash
pnpm build
pnpm quality && pnpm test
```

## Documentation

| Sujet | Fichier |
|-------|---------|
| Architecture backend | [`backend-nest/ARCHITECTURE.md`](./backend-nest/ARCHITECTURE.md) |
| Base de données | [`backend-nest/DATABASE.md`](./backend-nest/DATABASE.md) |
| Tests E2E | [`frontend/run-tests.md`](./frontend/run-tests.md) |
| Monorepo & Turbo | [`MONOREPO.md`](./MONOREPO.md) |

## Licence

MIT
