# Deployment

## Pipeline

- Complete CI validates PRs to `main`; no complete matrix runs on protected-branch pushes. Vercel/Railway Git integrations deploy the merged commits, and the push to `main` starts the exact staging proof. An authorized early merge makes the proof wait at most 30 minutes for that same canonical CI run; timeout, failure, unknown state, API error, or a moved `main` fails closed.
- A just-created deployment status may transiently return GitHub `HTTP 404`; the staging proof treats only that response as pending inside its bounded loop. Rerun after any other transient provider or GitHub failure only while `main` still points to the candidate SHA and the exact canonical CI evidence artifact remains unexpired; never certify a historical SHA after `main` moves.

## Environments

- `main` → trunk + staging/QA; `production` → production pointer. Production: `pulpe.app`, `app.pulpe.app`, `api.pulpe.app`; local uses Supabase CLI.

## Release

- Canonical operations and cutover settings: `docs/DEPLOYMENT.md#release-process`; canonical version/notes approval: `.claude/skills/release/SKILL.md`.
- Native GitHub auto-merge applies only to the explicitly approved release PR. One main-push run sequences staging → reusable production → reusable finalization → optional iOS submission. Exact source, notes, deployments and terminal remote objects remain verified.
- No lock branch, custom auto-merger or automatic recovery. Stop on main drift, partial production advance, existing automatic iOS build/version or ambiguous submission. Internal TestFlight is a separate dispatch.
- Auto-merge enablement and production reviewer removal require a separately approved one-time settings change; repository YAML alone cannot enact them.

## Monitoring

- PostHog error tracking/releases, Pino JSON/request IDs, Railway `/health`, and provider dashboards. No alert destination is defined in-repo.
