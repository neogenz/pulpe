# Deployment

## Pipeline

- Complete CI validates PRs to `main`; no complete matrix runs on protected-branch pushes. Vercel/Railway Git integrations deploy the merged commits, and the push to `main` starts the exact staging proof. An authorized early merge makes the proof wait at most 30 minutes for that same canonical CI run; timeout, failure, unknown state, API error, or a moved `main` fails closed.
- Rerun a staging proof after a transient provider or GitHub failure only while `main` still points to the candidate SHA and the exact canonical CI evidence artifact remains unexpired; never certify a historical SHA after `main` moves.

## Environments

- `main` → trunk + staging/QA; `production` → production pointer. Production: `pulpe.app`, `app.pulpe.app`, `api.pulpe.app`; local uses Supabase CLI.

## Release

- `/release` creates one `release/vX.Y.Z` branch and one lockstep version commit from synchronized `main`, merged back through its single preparation PR — that merge commit is the candidate and must stay the exact tip of `main` until publication. The single manual entry `🚦 Release Promotion` has two modes: a read-only `plan` job (no secret, environment, or write permission) that resolves the proven candidate, the latest published release (rollback anchor), lineage, migrations and provider deployment IDs into a `release-plan` manifest, and `publish` on `main`, the sole caller of the reusable `production.yml`.
- `publish` replays the migration contract on the published-anchor/candidate range before `supabase db push`, verifies the same tree and exact deployments before the immutable `vX.Y.Z` tag/GitHub Release; the web version comes from the deployed backend artifact. Proof resolution never depends on `workflow_run.pull_requests[]`, which may be empty after merge. See `docs/DEPLOYMENT.md`.
- GitHub deployment success is not sufficient proof for Railway: the finalizer reads Railway directly, verifies that the existing latest successful `production` deployment matches the exact production commit, and records its ID in the final proof. The normal workflow must not invoke `serviceInstanceDeployV2` or trigger a redeploy. A recovery stays fail-closed and idempotent, with maintenance kept or restored until migrations, the exact backend, version gates and public health are verified.
- iOS crash reports symbolicate only if the archive's dSYMs reached PostHog: after `xcodebuild archive`, run `ios/scripts/upload-dsyms.sh` (auth: `posthog-cli login` once, or `POSTHOG_CLI_PROJECT_ID` + `POSTHOG_CLI_API_KEY` in the shell; never committed).
- iOS distribution treats proof artifacts as existence markers: it verifies the exact SHA, trusted workflow success and one unexpired named artifact, but never downloads the payload; `ci-security` preserves this artifact-poisoning boundary.
- Application rollback uses Vercel rollback or Railway redeploy; no database-migration rollback procedure is codified. See `docs/TROUBLESHOOTING.md`.

## Monitoring

- PostHog error tracking/releases, Pino JSON/request IDs, Railway `/health`, and provider dashboards. No alert destination is defined in-repo.
