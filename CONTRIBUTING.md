# Contributing to Pulpe

Pulpe is a pnpm + Turborepo monorepo (Angular frontend, NestJS backend, SwiftUI iOS app, Next.js landing, shared Zod schemas). See [CLAUDE.md](./CLAUDE.md) for the stack and day-to-day commands.

## Branch model

Pulpe uses a two-branch flow: one integration branch for the sprint, one release branch for production.

| Branch                                            | Role                                                                          | Deploys to                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `preview`                                         | **Default branch.** Sprint integration + QA. All feature branches merge here. | Staging / QA (Vercel Preview, Railway `preview` env)       |
| `main`                                            | **Release / production.** Fed by `preview` at release time only.              | Production (`pulpe.app`, `app.pulpe.app`, `api.pulpe.app`) |
| `feature/*`, `fix/*` (and Linear-generated names) | Day-to-day work. Branch off `preview`.                                        | Per-branch Vercel preview                                  |

```text
feature/* ──PR──▶ preview
                     │
              release/vX.Y.Z ──PR──▶ preview ──proof──▶ same frozen branch ──PR──▶ main
```

## Workflow

1. **Branch off `preview`**: `git switch preview && git pull && git switch -c feature/my-thing`
2. **Develop**, using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, …).
3. **Quality gate before pushing**: `pnpm quality` (type-check + lint + format) plus the relevant tests (`pnpm test`, `pnpm test:e2e`).
4. **Open a PR into `preview`** (not `main`). The `✅ CI Success` check must pass, and the PR needs 1 approving review with all review threads resolved.
5. **Validate on the QA environment.** Once merged, `preview` deploys to staging — verify the change there.
6. **Release** from a synchronized `preview` with `/release`; the protected two-PR flow promotes one frozen candidate to `main` (see [Release](#release)).

## Protected branches

Enforced by GitHub rulesets (`preview-protection`, `main-protection` and `tag-protection`):

- `preview`: no deletion or force-push; PR, one approval, resolved threads and `✅ CI Success` are required. The solo maintainer keeps the administrator bypass for ordinary PRs authored with the maintainer account.
- `main`: no deletion, force-push or administrator bypass; the App-authored release PR requires one human approval, resolved threads and `✅ Release Gate`.
- Release tags `v*`: immutable (no deletion, no force-move).

## Release

A release uses one `release/vX.Y.Z` branch and one version commit. The App first opens
that branch toward `preview`; after complete CI, merge, exact staging deployments and
QA, it advances the same branch to the proven merge commit and opens the production PR
toward `main`. A human approves that PR. GitHub then verifies production, creates the
single tag and GitHub Release, and synchronizes the web version gate. Later feature
merges into `preview` do not alter the frozen candidate. If `preview` advances before
the preparation merge, the immutable-base check stops promotion and the release is
reprepared rather than silently absorbing extra features.

- Full steps: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#release-process)
- Versioning rules: [docs/VERSIONING.md](./docs/VERSIONING.md)

## Dependencies & security

- Dependabot **security** PRs target the **default branch** (`preview`) and flow through the normal QA → release path. (GitHub only raises security updates against the default branch — that is the reason `preview` is the default.)
- Active GitHub security features: secret scanning + push protection, Dependabot alerts + security updates.
- CI jobs that need repository secrets are skipped for `dependabot[bot]` (Dependabot PRs run with an isolated secret store), so a green Dependabot PR is expected.

## More

- Commands & stack: [CLAUDE.md](./CLAUDE.md)
- Documentation index: [docs/INDEX.md](./docs/INDEX.md)
- Architecture: [aidd_docs/memory/architecture.md](./aidd_docs/memory/architecture.md)
