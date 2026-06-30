# Contributing to Pulpe

Pulpe is a pnpm + Turborepo monorepo (Angular frontend, NestJS backend, SwiftUI iOS app, Next.js landing, shared Zod schemas). See [CLAUDE.md](./CLAUDE.md) for the stack and day-to-day commands.

## Branch model

Pulpe uses a two-branch flow: one integration branch for the sprint, one release branch for production.

| Branch | Role | Deploys to |
|--------|------|------------|
| `preview` | **Default branch.** Sprint integration + QA. All feature branches merge here. | Staging / QA (Vercel Preview, Railway `preview` env) |
| `main` | **Release / production.** Fed by `preview` at release time only. | Production (`pulpe.app`, `app.pulpe.app`, `api.pulpe.app`) |
| `feature/*`, `fix/*` (and Linear-generated names) | Day-to-day work. Branch off `preview`. | Per-branch Vercel preview |

```
feature/* ──PR──▶ preview ──(sprint validated on QA)──▶ main
                  (default, QA)                          (release, prod)
```

## Workflow

1. **Branch off `preview`**: `git switch preview && git pull && git switch -c feature/my-thing`
2. **Develop**, using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, …).
3. **Quality gate before pushing**: `pnpm quality` (type-check + lint + format) plus the relevant tests (`pnpm test`, `pnpm test:e2e`).
4. **Open a PR into `preview`** (not `main`). The `✅ CI Success` check must pass, and the PR needs 1 approving review with all review threads resolved.
5. **Validate on the QA environment.** Once merged, `preview` deploys to staging — verify the change there.
6. **Release** when the sprint's work is validated: promote `preview` → `main` (see [Release](#release)).

## Protected branches

Enforced by GitHub rulesets (`main-protection` + `tag-protection`):

- `main` **and** `preview`: no deletion, no force-push, PR required with 1 approving review + thread resolution + dismiss-stale-on-push, required status check `✅ CI Success`.
- Release tags `v*`: immutable (no deletion, no force-move).
- The repository admin can bypass branch rules — required so a solo maintainer can merge, since GitHub does not allow approving your own PR.

## Release

A release is cut on `main`: promote `preview` → `main`, which triggers production CI/CD (Vercel frontend + landing, Railway backend, Supabase migrations). Versioning is single-version lockstep via Changesets.

- Full steps: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#release-process)
- Versioning rules: [docs/VERSIONING.md](./docs/VERSIONING.md)

## Dependencies & security

- Dependabot **security** PRs target the **default branch** (`preview`) and flow through the normal QA → release path. (GitHub only raises security updates against the default branch — that is the reason `preview` is the default.)
- Active GitHub security features: secret scanning + push protection, Dependabot alerts + security updates.
- CI jobs that need repository secrets are skipped for `dependabot[bot]` (Dependabot PRs run with an isolated secret store), so a green Dependabot PR is expected.

## More

- Commands & stack: [CLAUDE.md](./CLAUDE.md)
- Documentation index: [docs/INDEX.md](./docs/INDEX.md)
- Architecture: [memory-bank/systemPatterns.md](./memory-bank/systemPatterns.md)
