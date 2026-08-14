# Pulpe Landing

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10.12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com)

Site marketing statique construit avec Next.js 16, React 19 et Tailwind CSS v4.

## Développement

Depuis la racine :

```bash
pnpm install
pnpm build:landing
```

Depuis `landing/` :

```bash
pnpm dev        # http://localhost:3001
pnpm build      # export statique dans dist/
pnpm test
pnpm lint
pnpm type-check
```

Copier `.env.example` vers `.env.local` pour les réglages PostHog locaux. Les valeurs de
production sont injectées par Vercel.

## Structure

- [`app/`](app/) : pages, styles globaux et métadonnées ;
- [`components/`](components/) : sections marketing et primitives UI ;
- [`lib/`](lib/) : helpers de devise, montants et verrouillage du scroll ;
- [`public/`](public/) : assets statiques ;
- [`scripts/`](scripts/) : génération Open Graph et publication des releases PostHog.

`next.config.ts` active l'export statique. `vercel.json` déploie ce projet séparément et
redirige `/app/*` vers `https://app.pulpe.app`.

Voir [DESIGN.md](DESIGN.md) pour les règles visuelles et
[VERCEL_ROUTING.md](../docs/VERCEL_ROUTING.md) pour la topologie de déploiement.
