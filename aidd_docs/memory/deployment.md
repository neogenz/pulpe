# Deployment

## Pipeline

- Complete CI validates PRs to `preview`; Vercel/Railway Git integrations deploy the merged preview and production commits. Railway preview success emits the `deployment_status` that starts the exact staging proof, avoiding a cycle with Railway `Wait for CI`.

## Environments

- `preview` → staging/QA; `main` → production. Production: `pulpe.app`, `app.pulpe.app`, `api.pulpe.app`; local uses Supabase CLI.

## Release

- `/release` creates one `release/vX.Y.Z` branch and one lockstep version commit from synchronized `preview`. The App opens it to `preview`; after exact staging proof it fast-forwards the same branch to the proven merge commit and opens it to `main`.
- A human approves the production PR. The protected workflow verifies the same tree in production before creating the single immutable `vX.Y.Z` tag/GitHub Release and synchronizing `LATEST_WEB_VERSION`. See `docs/DEPLOYMENT.md`.
- Application rollback uses Vercel rollback or Railway redeploy; no database-migration rollback procedure is codified. See `docs/TROUBLESHOOTING.md`.

## Monitoring

- PostHog error tracking/releases, Pino JSON/request IDs, Railway `/health`, and provider dashboards. No alert destination is defined in-repo.
