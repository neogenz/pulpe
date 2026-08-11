<div align="center">

<img src="frontend/projects/webapp/public/logo.svg" alt="Pulpe" width="120" />

# Pulpe

**Tu sais ce qu'il te reste ? Pulpe, oui.**

Planification budgétaire personnelle pour la Suisse, sur le web et iOS.

[pulpe.app](https://pulpe.app) · [App Store](https://apps.apple.com/app/id6758464920)

</div>

## Produit

Pulpe aide à planifier avant de dépenser : Mois Types réutilisables, budgets mensuels,
Prévu face au Réel, report du solde, lissage de dépenses, objectifs d'épargne, tags et mode
démo. Les montants peuvent être affichés en CHF ou EUR.

La stratégie produit et le vocabulaire de référence vivent dans [PRODUCT.md](PRODUCT.md).

## Stack

| Surface | Technologies |
| --- | --- |
| Web | Angular 22, Signals, Material 22, Tailwind CSS v4 |
| API | NestJS 11, Bun, Supabase PostgreSQL/Auth/RLS |
| iOS | SwiftUI, WidgetKit, iOS 18+ |
| Landing | Next.js 16, React 19, static export |
| Partagé | TypeScript 6, Zod 4 |
| Monorepo | pnpm, Turborepo |

## Démarrage local

Prérequis : Node.js 24, pnpm 10, Bun 1.2, Docker et la CLI Supabase.

```bash
pnpm install
cp backend-nest/.env.example backend-nest/.env.local
cp frontend/.env.example frontend/.env
(cd backend-nest && bun run supabase:start:local && supabase status -o env)
openssl rand -hex 32
```

Reporter les valeurs locales affichées par Supabase dans `backend-nest/.env.local` :
`API_URL` → `SUPABASE_URL`, `ANON_KEY` (ou `PUBLISHABLE_KEY`) → `SUPABASE_ANON_KEY`, et
`SERVICE_ROLE_KEY` (ou `SECRET_KEY`) → `SUPABASE_SERVICE_ROLE_KEY`. Reporter aussi la clé
anonyme dans `frontend/.env`, puis remplacer `ENCRYPTION_MASTER_KEY` par la sortie OpenSSL.

```bash
pnpm dev
```

Services locaux : web `http://localhost:4200`, API `http://localhost:3000/api/v1`,
Swagger `http://localhost:3000/docs`, Supabase Studio `http://localhost:54323`.

## Commandes

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm quality
```

Les commandes ciblées et les contraintes critiques sont dans [AGENTS.md](AGENTS.md).

## Arborescence

```text
frontend/       application Angular
backend-nest/   API NestJS et projet Supabase
ios/            application SwiftUI et widget
landing/        site marketing Next.js
shared/         contrats Zod et formules partagées
aidd_docs/      mémoire, spécifications et plans d'exécution
```

## Documentation

- [Index documentaire](docs/INDEX.md)
- [Contribution](CONTRIBUTING.md)
- [Architecture backend](backend-nest/docs/ARCHITECTURE.md)
- [Règles métier](docs/BUSINESS_RULES.md)
- [Chiffrement](docs/ENCRYPTION.md)
- [Design](DESIGN.md)
