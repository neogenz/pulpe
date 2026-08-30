# Contributing to Pulpe

Pulpe is a pnpm + Turborepo monorepo (Angular frontend, NestJS backend, SwiftUI iOS app, Next.js landing, shared Zod schemas). See [CLAUDE.md](./CLAUDE.md) for the stack and day-to-day commands.

## Branch model

Pulpe uses a trunk plus a production pointer: everything integrates on `main`, which is also the permanent staging environment.

| Branch                                            | Role                                                                            | Deploys to                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `main`                                            | **Default branch.** Trunk + permanent staging. All feature branches merge here. | Staging / QA (Vercel Preview, Railway `preview` env)       |
| `production`                                      | **Production pointer.** Advanced only by the release publish job.               | Production (`pulpe.app`, `app.pulpe.app`, `api.pulpe.app`) |
| `feature/*`, `fix/*` (and Linear-generated names) | Day-to-day work. Branch off `main`.                                             | Per-branch Vercel preview                                  |

```text
feature/* ──PR──▶ main
                    │
             release/vX.Y.Z ──PR──▶ main ──proof──▶ publish ──▶ production
```

## Workflow

1. **Branch off `main`**: `git switch main && git pull && git switch -c feature/my-thing`
2. **Develop**, using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, …).
3. **Quality gate before pushing**: `pnpm quality` (type-check + lint + format) plus the relevant tests (`pnpm test`, `pnpm test:e2e`).
4. **Open a PR into `main`**. The `✅ CI Success` check must pass and all review threads must be resolved.
5. **Validate on the QA environment.** Once merged, `main` deploys to staging — verify the change there.
6. **Release** from a synchronized `main` with `/release`; one preparation PR merges back into `main` and the protected publish advances `production` (see [Release](#release)).

## Protected branches

Enforced by GitHub rulesets (`main-protection`, `production-protection` and `tag-protection`):

- `main`: no deletion or force-push; a PR, resolved review threads and `✅ CI Success` are required. No approving review is required: GitHub forbids approving your own pull request, so on a solo repository that rule would block every merge, including the release preparation PR. The human authorization for a release is the GitHub `production` environment approval instead.
- `production`: no deletion, force-push or administrator bypass; only the release publish job advances it, fast-forward only.
- Release tags `v*`: immutable (no deletion, no force-move).

## Release

A release uses one `release/vX.Y.Z` branch and one version commit, merged back into
`main` through its single preparation PR after complete CI. That merge commit is the
candidate: it deploys staging, produces the exact staging proof, and must remain the
tip of `main` until publication. The single manual entry, `🚦 Release Promotion`,
runs a read-only `plan` that resolves the proven candidate, lineage, migrations and
rollback anchor, then a protected `publish` that migrates, advances `production` and
creates the single tag and GitHub Release. A feature merged into `main` before publish
moves the tip away from the candidate: authorization fails closed and the release is
reprepared rather than silently absorbing extra features.

- Full steps: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#release-process)
- Versioning rules: [docs/VERSIONING.md](./docs/VERSIONING.md)

The process is fully recoverable from the GitHub Actions UI or `gh`; agent-local
state is never part of the release identity or proof.

## Dependencies & security

- Dependabot **security** PRs target the **default branch** (`main`) and flow through the normal QA → release path. (GitHub only raises security updates against the default branch.)
- Active GitHub security features: secret scanning + push protection, Dependabot alerts + security updates.
- CI jobs that need repository secrets are skipped for `dependabot[bot]` (Dependabot PRs run with an isolated secret store), so a green Dependabot PR is expected.

## More

- Commands & stack: [CLAUDE.md](./CLAUDE.md)
- Documentation index: [docs/INDEX.md](./docs/INDEX.md)
- Architecture: [aidd_docs/memory/architecture.md](./aidd_docs/memory/architecture.md)
