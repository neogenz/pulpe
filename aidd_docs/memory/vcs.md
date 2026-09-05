# VCS

## Setup

- Trunk and staging branch: `main`; production pointer branch: `production`.
- Platform: GitHub (`neogenz/pulpe`); ticketing: Linear (`PUL-*`).

## Branches

- Branch from and PR into `main`. A release uses one `release/vX.Y.Z` branch and its single preparation PR to `main`; approving its exact version/notes authorizes trusted CI to auto-merge, prove staging, advance `production`, finalize publication and submit App Review when declared. Any concurrent merge moves the tip away from the candidate and fails authorization closed.
- Formats include `feature/*`, `fix/*`, and Linear-generated names.
- The former durable `preview` branch and its ruleset were removed after the cutover; no active workflow or provider depends on them.

## Commits

- Conventional Commits, commonly `feat`, `fix`, `chore`, `refactor`, `test`, and `docs`, optionally scoped.
- `main` requires a PR, resolved threads and `✅ CI Success`, not an approving review. Enable native auto-merge only for the exact approved release PR, never the infrastructure PR. `production` advances without force; tags remain immutable. See `docs/DEPLOYMENT.md` for settings prerequisites and failure handling.
