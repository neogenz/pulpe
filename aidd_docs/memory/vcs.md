# VCS

## Setup

- Main integration branch: `preview`; production release branch: `main`.
- Platform: GitHub (`neogenz/pulpe`); ticketing: Linear (`PUL-*`).

## Branches

- Branch from and PR into `preview`. A release uses one `release/vX.Y.Z` branch in two protected PRs: preparation to `preview`, then the exact proven candidate to `main`; later preview merges do not change it.
- Formats include `feature/*`, `fix/*`, and Linear-generated names.

## Commits

- Conventional Commits, commonly `feat`, `fix`, `chore`, `refactor`, `test`, and `docs`, optionally scoped.
- `preview` requires PR, approval, resolved threads and `✅ CI Success`; its admin bypass remains for the solo maintainer's own ordinary PRs. `main` has no bypass and requires the App-authored release lineage, `✅ Release Gate`, exact staging proof and a human approval. Production binds the gate to the PR head branch/SHA and records the successful run/attempt/job; it does not infer PR identity from an Actions run's optional `pull_requests[]`. `v*` tags are immutable. See `CONTRIBUTING.md`.
