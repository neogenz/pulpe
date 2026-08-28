# Troubleshooting

Start from the failing command and keep the first complete error. Avoid resets, force pushes,
Docker-wide cleanup, or deleting the whole dependency tree before the cause is known.

## Workspace and dependencies

```bash
pnpm install --frozen-lockfile
pnpm build:shared
pnpm build
```

If generated shared output disagrees with source, rebuild `pulpe-shared`; frontend tests read
`shared/dist/esm`. A stale local install should be reconciled with `pnpm install`, not by
editing generated package files.

## Frontend

```bash
cd frontend
pnpm generate:config
pnpm type-check
pnpm exec ng test --include "**/foo.spec.ts"
pnpm test:e2e --grep "scenario"
```

- Runtime configuration is generated from the active `.env*` file into
  `projects/webapp/public/config.json`.
- Template errors require `pnpm build`; TypeScript checks alone do not run `strictTemplates`.
- Browser-only failures should be reproduced with Playwright before changing unit-test mocks.

## Backend and Supabase

Run every Supabase command from `backend-nest/`:

```bash
cd backend-nest
supabase status
supabase start
bun run generate-types:local
bun test path/to/file.spec.ts
```

If a migration fails, inspect `supabase migration list`, the failing SQL, and the current
generated types. Fix forward with a new migration when the migration already exists on a
shared environment. Do not use `db reset` or a forced push as a repair step.

For RLS failures, reproduce through the authenticated repository or integration test rather
than the service-role client. The current schema contract is
`backend-nest/src/types/database.types.ts`; see
[DATABASE.md](../backend-nest/docs/DATABASE.md).

## CI

```bash
gh run list --limit 5
gh run view <run-id> --log-failed
pnpm quality
```

`✅ CI Success` aggregates the required jobs. Diagnose the named failing job; rerunning the
aggregate status does not repair its dependency. Workflow syntax is checked by `actionlint`.

For a release proof mismatch (staging or production), correlate the exact head branch and
SHA with the workflow run, then inspect `/actions/runs/{run_id}/attempts/{attempt}` and that
attempt's `/jobs` endpoint. Do not use `workflow_run.pull_requests[]` as the sole PR identity
and do not let a failed rerun hide an earlier immutable successful attempt.

## Deployments

- Vercel: inspect the deployment attached to `landing/` or `frontend/` and its build logs.
- Railway: inspect the deployment logs and `/health` before redeploying.
- PostHog: verify release and sourcemap status using [MONITORING.md](MONITORING.md).
- Routing/CSP: compare the deployed headers with [VERCEL_ROUTING.md](VERCEL_ROUTING.md) and
  [CSP.md](CSP.md).

Rollback application code through the provider's deployment history. Database rollback is
not automated; follow [DEPLOYMENT.md](DEPLOYMENT.md) and prefer a forward migration.

## iOS

Regenerate the Xcode project before debugging project-file drift:

```bash
cd ios
xcodegen generate
xcodebuild -scheme PulpeLocal -showdestinations
```

Use a destination returned by that command. A successful `-only-testing:` invocation may run
zero Swift Testing tests, so verify the executed-test count.
