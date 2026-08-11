# Pulpe Web

Application Angular 22 basée sur Signals, Angular Material 22, Tailwind CSS v4 et
`ngx-ziflux` pour le cache SWR.

## Architecture

Le code applicatif vit dans `projects/webapp/src/app/` :

- `core/` : infrastructure et services singleton ;
- `layout/` : shell et navigation ;
- `feature/` : fonctionnalités lazy-loaded et isolées ;
- `pattern/` : composants métier réutilisables ;
- `ui/` : présentation générique sans logique métier.

`eslint-plugin-boundaries` applique les dépendances entre couches. Les détails utiles à
l'édition sont chargés depuis `.claude/rules/00-architecture/layer-*.md`.

## Développement

Depuis la racine du monorepo :

```bash
pnpm install
pnpm dev:frontend
```

Depuis `frontend/` :

```bash
pnpm start
pnpm build
pnpm test
pnpm type-check
pnpm lint
pnpm test:e2e
```

Pour un seul test :

```bash
pnpm exec ng test --include "**/foo.spec.ts"
```

Les variables publiques partent de `.env.example`; `prestart` et `prebuild` génèrent la
configuration servie dans `projects/webapp/public/config.json`.

## Références

- [Design web](DESIGN.md)
- [Configuration frontend](../docs/FRONTEND_CONFIG.md)
- [Stratégie E2E](e2e/docs/TESTING_STRATEGY.md)
- [Cache SWR](../docs/angular-cache-swr-pattern.md)
- [Sourcemaps PostHog](docs/sourcemaps-upload.md)
