# Deployment

## Pipeline

- Complete CI validates PRs to `preview`; no complete matrix runs on protected-branch pushes. Vercel/Railway Git integrations deploy the merged commits, and Railway preview success emits the `deployment_status` that starts the exact staging proof.

## Environments

- `preview` → staging/QA; `main` → production. Production: `pulpe.app`, `app.pulpe.app`, `api.pulpe.app`; local uses Supabase CLI.

## Release

- `/release` creates one `release/vX.Y.Z` branch and one lockstep version commit from synchronized `preview`. The App opens it to `preview`; the proof rejects any changed base, then fast-forwards the same branch to the proven merge commit and opens it to `main`.
- A human approves the production PR. The protected workflow applies migrations when present, verifies the same tree and exact deployments before creating the immutable `vX.Y.Z` tag/GitHub Release and synchronizing `LATEST_WEB_VERSION`. See `docs/DEPLOYMENT.md`.
- iOS distribution treats proof artifacts as existence markers: it verifies the exact SHA, trusted workflow success and one unexpired named artifact, but never downloads the payload; `ci-security` preserves this artifact-poisoning boundary.
- Application rollback uses Vercel rollback or Railway redeploy; no database-migration rollback procedure is codified. See `docs/TROUBLESHOOTING.md`.

## Monitoring

- PostHog error tracking/releases, Pino JSON/request IDs, Railway `/health`, and provider dashboards. No alert destination is defined in-repo.
