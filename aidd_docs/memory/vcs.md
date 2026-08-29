# VCS

## Setup

- Main integration branch: `preview`; production release branch: `main`.
- Platform: GitHub (`neogenz/pulpe`); ticketing: Linear (`PUL-*`).

## Branches

- Branch from and PR into `preview`. A release uses one `release/vX.Y.Z` branch and its preparation PR to `preview`; production is reached through the plan/apply promotion (apply arrives with the phase-9 cutover), and later preview merges do not change the frozen candidate.
- Formats include `feature/*`, `fix/*`, and Linear-generated names.

## Commits

- Conventional Commits, commonly `feat`, `fix`, `chore`, `refactor`, `test`, and `docs`, optionally scoped.
- `preview` requires PR, approval, resolved threads and `✅ CI Success`; its admin bypass remains for the solo maintainer's own ordinary PRs. `main` has no bypass; release PRs toward it are frozen until the phase-9 plan/apply cutover (the ruleset still lists the deleted legacy gate check, which phase 9 replaces with the protected apply path plus exact staging proof and a human approval). Proof resolution binds to exact run/attempt/job and never infers PR identity from an Actions run's optional `pull_requests[]`. `v*` tags are immutable. See `CONTRIBUTING.md`.
