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
             release/vX.Y.Z ──PR+CI──▶ auto-merge ──proof──▶ production ──▶ release
```

## Workflow

1. **Branch off `main`**: `git switch main && git pull && git switch -c feature/my-thing`
2. **Develop**, using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, …).
3. **Quality gate before pushing**: `pnpm quality` (type-check + lint + format) plus the relevant tests (`pnpm test`, `pnpm test:e2e`).
4. **Open a PR into `main`**. The `✅ CI Success` check must pass and all review threads must be resolved.
5. **Validate on the QA environment.** Once merged, `main` deploys to staging — verify the change there.
6. **Release** from a synchronized `main` with `/release`; approving the exact version and notes authorizes the automatic PR → production → publication chain (see [Release](#release)).

## Protected branches

Enforced by GitHub rulesets (`main-protection`, `production-protection` and `tag-protection`):

- `main`: no deletion or force-push; a PR, resolved review threads and `✅ CI Success` are required. No approving review is required: GitHub forbids approving your own pull request on a solo repository. Native auto-merge is enabled only for the explicitly approved release PR, with no CI bypass.
- `production`: no deletion, force-push or administrator bypass; only the release publish job advances it, fast-forward only.
- Release tags `v*`: immutable (no deletion, no force-move).

## Release

A release uses one approved version/notes proposal, one `release/vX.Y.Z` commit and one PR to `main`. The approving releaser enables native auto-merge for that exact head. Its main-push run sequences staging, production, GitHub publication and optional iOS App Review; feature PRs stop after staging.

Never auto-merge the release-infrastructure PR. Repository auto-merge and removal of the production reviewer gate are separate, explicitly approved setup changes. No release lock or automatic recovery: exact-SHA drift or ambiguous mutation stops the chain.

- Canonical preparation: [.claude/skills/release/SKILL.md](./.claude/skills/release/SKILL.md)
- Setup, execution and failure handling: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#release-process)

## Dependencies & security

- Dependabot **security** PRs target the **default branch** (`main`) and flow through the normal QA → release path. (GitHub only raises security updates against the default branch.)
- Active GitHub security features: secret scanning + push protection, Dependabot alerts + security updates.
- CI jobs that need repository secrets are skipped for `dependabot[bot]` (Dependabot PRs run with an isolated secret store), so a green Dependabot PR is expected.

## More

- Commands & stack: [CLAUDE.md](./CLAUDE.md)
- Documentation index: [docs/INDEX.md](./docs/INDEX.md)
- Architecture: [aidd_docs/memory/architecture.md](./aidd_docs/memory/architecture.md)
