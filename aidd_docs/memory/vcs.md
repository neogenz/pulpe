# VCS

## Setup

- Main integration branch: `preview`; production release branch: `main`.
- Platform: GitHub (`neogenz/pulpe`); ticketing: Linear (`PUL-*`).

## Branches

- Branch from and PR into `preview`. A release uses one `release/vX.Y.Z` branch in two protected PRs: preparation to `preview`, then the exact proven candidate to `main`; later preview merges do not change it.
- Formats include `feature/*`, `fix/*`, and Linear-generated names.

## Commits

- Conventional Commits, commonly `feat`, `fix`, `chore`, `refactor`, `test`, and `docs`, optionally scoped.
- `preview`/`main` require PR, approval and resolved threads. Production additionally requires the App-authored release lineage, `✅ Release Gate`, exact staging proof and a human approval; `v*` tags are immutable. See `CONTRIBUTING.md`.
