# VCS

## Setup

- Trunk and staging branch: `main`; production pointer branch: `production`.
- Platform: GitHub (`neogenz/pulpe`); ticketing: Linear (`PUL-*`).

## Branches

- Branch from and PR into `main`. A release uses one `release/vX.Y.Z` branch and its single preparation PR to `main`; production is reached through the plan/publish promotion, and any later merge to `main` moves the tip away from the candidate and fails authorization closed.
- Formats include `feature/*`, `fix/*`, and Linear-generated names.

## Commits

- Conventional Commits, commonly `feat`, `fix`, `chore`, `refactor`, `test`, and `docs`, optionally scoped.
- `main` requires PR, resolved threads and `✅ CI Success`, but NO approving review: GitHub forbids approving your own PR, so on a solo repository that rule would block every merge, the release preparation PR included. `production` has no bypass and is advanced fast-forward only by the publish job, behind the GitHub `production` environment approval plus the exact staging proof. Proof resolution binds to exact run/attempt/job and never infers PR identity from an Actions run's optional `pull_requests[]`. `v*` tags are immutable. See `CONTRIBUTING.md`.
