# Deployment

## Pipeline

- Complete CI validates PRs to `preview`; no complete matrix runs on protected-branch pushes. Vercel/Railway Git integrations deploy the merged commits, and Railway preview success emits the `deployment_status` that starts the exact staging proof. An authorized early merge makes the proof wait at most 30 minutes for that same canonical CI run; timeout, failure, unknown state, API error, or a moved `preview` fails closed.
- Rerun a staging proof after a transient provider or GitHub failure only while `preview` still points to the candidate SHA and the exact canonical CI evidence artifact remains unexpired; never certify a historical SHA after `preview` moves.

## Environments

- `preview` → staging/QA; `main` → production. Production: `pulpe.app`, `app.pulpe.app`, `api.pulpe.app`; local uses Supabase CLI.

## Release

- `/release` creates one `release/vX.Y.Z` branch and one lockstep version commit from synchronized `preview`. The App opens it to `preview`; the proof rejects any changed base, then fast-forwards the same branch to the proven merge commit and opens it to `main`.
- A human approves the production PR. The protected workflow correlates the Release Gate by the PR's exact head branch and SHA, checks immutable run attempts and their named jobs, and accepts a historical successful attempt even if a later rerun fails. It never depends on `workflow_run.pull_requests[]`, which may be empty after merge. It applies migrations when present, verifies the same tree and exact deployments before creating the immutable `vX.Y.Z` tag/GitHub Release and synchronizing `LATEST_WEB_VERSION`. See `docs/DEPLOYMENT.md`.
- GitHub deployment success is not sufficient proof for Railway: publication reads Railway directly, deploys the exact production commit with `serviceInstanceDeployV2` when necessary, requires that deployment to be the latest successful `main` deployment, and records its ID in the final proof. A recovery stays fail-closed and idempotent, with maintenance kept or restored until migrations, the exact backend, version gates and public health are verified.
- iOS distribution treats proof artifacts as existence markers: it verifies the exact SHA, trusted workflow success and one unexpired named artifact, but never downloads the payload; `ci-security` preserves this artifact-poisoning boundary.
- Application rollback uses Vercel rollback or Railway redeploy; no database-migration rollback procedure is codified. See `docs/TROUBLESHOOTING.md`.

## Monitoring

- PostHog error tracking/releases, Pino JSON/request IDs, Railway `/health`, and provider dashboards. No alert destination is defined in-repo.
