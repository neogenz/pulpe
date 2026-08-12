# Documentation Pulpe

Le [README racine](../README.md) couvre l'installation et les commandes courantes.
Cet index route vers les documents qui possèdent un sujet durable ; les plans d'exécution
vivent dans `aidd_docs/tasks/`.

## Produit et design

- [PRODUCT.md](../PRODUCT.md) — stratégie, public et principes produit.
- [DESIGN.md](../DESIGN.md) — règles visuelles communes.
- [Design web](../frontend/DESIGN.md), [iOS](../ios/DESIGN.md) et
  [landing](../landing/DESIGN.md) — extensions par plateforme.
- [Principes UX/UI](ux-ui-principles.md) — recherche et heuristiques de conception.

## Métier

- [Règles métier](BUSINESS_RULES.md) — index des invariants transverses.
- [Workflow métier](BUSINESS_WORKFLOW.md) — cycle Mois Type, budget, Prévu et Réel.
- [Scénarios](SCENARIOS.md) — scénarios fonctionnels web et iOS.
- [Objectifs d'épargne](SAVINGS.md) — progression, plan et retraits.
- [Lissage](SPREAD.md) — étalement et report d'une dépense.
- [Consentement](CONSENT.md) — contrat de consentement à l'inscription.

## Architecture

- [Architecture backend](../backend-nest/docs/ARCHITECTURE.md) et
  [ADRs](adr/README.md).
- [Base de données](../backend-nest/docs/DATABASE.md).
- [Logging backend](../backend-nest/docs/LOGGING.md).
- [Cache SWR Angular](angular-cache-swr-pattern.md).
- [Machine d'état d'authentification iOS](../ios/docs/auth-state-machine.md) et
  [guide d'extension](../ios/docs/auth-flow-extension-guide.md).

## Sécurité et exploitation

- [Chiffrement](ENCRYPTION.md) — architecture split-key AES-256-GCM.
- [CSP](CSP.md) — politiques web et dette `unsafe-inline`.
- [CI](CI.md) — jobs et gates GitHub Actions.
- [Déploiement](DEPLOYMENT.md) — preview, production et migrations.
- [Troubleshooting](TROUBLESHOOTING.md).
- [Routing Vercel](VERCEL_ROUTING.md).
- [Configuration frontend](FRONTEND_CONFIG.md).
- [Monitoring](MONITORING.md), [releases PostHog](POSTHOG_RELEASES.md) et
  [upload des sourcemaps](../frontend/docs/sourcemaps-upload.md).
- [Versioning produit](VERSIONING.md) et [versioning iOS](IOS_VERSIONING.md).

## Contexte agents

- [AGENTS.md](../AGENTS.md) — instructions partagées par les agents.
- [Mémoire AIDD](../aidd_docs/memory/README.md) — état concis du projet.
