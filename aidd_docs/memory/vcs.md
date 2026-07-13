# VCS

## Setup
- Main integration branch: `preview`; production release branch: `main`.
- Platform: GitHub (`neogenz/pulpe`); ticketing: Linear (`PUL-*`).

## Branches
- Branch from and PR into `preview`; release promotes `preview → main`.
- Formats include `feature/*`, `fix/*`, and Linear-generated names.

## Commits
- Conventional Commits, commonly `feat`, `fix`, `chore`, `refactor`, `test`, and `docs`, optionally scoped.
- `preview`/`main` require PR, approval, resolved threads, and `✅ CI Success`; `v*` tags are immutable. See `CONTRIBUTING.md`.
