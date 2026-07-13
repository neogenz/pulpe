# Deployment

## Pipeline
- GitHub Actions gates pushes/PRs with build, quality, unit/integration/E2E/performance, iOS, and migration checks. External Vercel/Railway Git integrations deploy apps.

## Environments
- `preview` → staging/QA; `main` → production. Production: `pulpe.app`, `app.pulpe.app`, `api.pulpe.app`; local uses Supabase CLI.

## Release
- Promote `preview → main`, apply the version policy in [package.md](package.md), then create immutable `vX.Y.Z` tag/GitHub Release. See `docs/DEPLOYMENT.md`.
- Application rollback uses Vercel rollback or Railway redeploy; no database-migration rollback procedure is codified. See `docs/TROUBLESHOOTING.md`.

## Monitoring
- PostHog error tracking/releases, Pino JSON/request IDs, Railway `/health`, and provider dashboards. No alert destination is defined in-repo.
