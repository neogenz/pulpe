---
objective: "On web (desktop and phone), iOS and Android, « Comparer avec mes comptes » opens with its 3-scene guide the first time, compares today's balances with a Pulpe figure that ignores unchecked items of the two previous months, and walks every gap to a check, a noted « Écart avec mes comptes » or « Laisser comme ça », as written in spec.md."
status: pending
---

# Plan: Redo « Comparer avec mes comptes » on web, iOS and Android

Source: [`decisions.md`](./decisions.md) (framing with Maxime, 2026-11-19 → 2026-11-21), [`spec.md`](./spec.md) (rules, screen selection and copy), board https://claude.ai/artifact/VSGHiBCgPCkKD4pnH9kMWg (version 36).

## Phases

| #   | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1 | Shared rules: candidates, screen selection, guide events (TS + Swift) | [`phase-1.md`](./phase-1.md) | none |
| 2 | Backend: encrypted `user_reconciliation` table | [`phase-2.md`](./phase-2.md) | none |
| 3 | Backend: comparison state endpoints | [`phase-3.md`](./phase-3.md) | 2 |
| 4 | Backend: previous months in the comparison | [`phase-4.md`](./phase-4.md) | 1, 3 |
| 5 | Web: guide | [`phase-5.md`](./phase-5.md) | 1 |
| 6 | Web: step 1 and entry points | [`phase-6.md`](./phase-6.md) | 5 |
| 7 | Web: step 2, suggestions, gaps below and matched | [`phase-7.md`](./phase-7.md) | 4, 6 |
| 8 | Web: step 2, more on accounts and other reasons | [`phase-8.md`](./phase-8.md) | 7 |
| 9 | iOS: guide | [`phase-9.md`](./phase-9.md) | 1 |
| 10 | iOS: step 1 and entry points | [`phase-10.md`](./phase-10.md) | 9 |
| 11 | iOS: step 2, suggestions, gaps below and matched | [`phase-11.md`](./phase-11.md) | 4, 10 |
| 12 | iOS: step 2, more on accounts and other reasons | [`phase-12.md`](./phase-12.md) | 11 |
| 13 | Android: guide | [`phase-13.md`](./phase-13.md) | 1 |
| 14 | Android: step 1 and entry points | [`phase-14.md`](./phase-14.md) | 13 |
| 15 | Android: step 2, suggestions, gaps below and matched | [`phase-15.md`](./phase-15.md) | 4, 14 |
| 16 | Android: step 2, more on accounts and other reasons | [`phase-16.md`](./phase-16.md) | 15 |

## External sources

| URL | What it settled |
| --- | --- |
| none | Every assumption was settled in the code on `origin/main` (ea41c2440). |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | The new table needs a `contract` migration with `-- pulpe:safe-after vX.Y.Z` on a released tag (`.github/scripts/check-migration-contract.cjs`, run by `pnpm test:migration-contract`; precedent `20261103120000_create_net_worth_tables.sql:1-2`). The rekey gains a v4; v1 to v3 are re-created fail-closed for a person holding a starting amount, as the net worth migration did (`:245-380`). On merge, the persistent staging Supabase branch, which follows `main`, receives it (`docs/DEPLOYMENT.md:68-70`); production gets it from the release workflow. | 2 |
| runtime | The comparison reads two more budgets per open, server side. Response time not measured: unverified. | 4 |
| regression | High. Web dialog (632 + 558 lines) and its spec (1173 lines, 44 cases), iOS sheet (434) and flow tests (369), Android sheet (786) and spec (733) are rewritten. `pointingCandidates` gains inputs, callers on 3 platforms. Safety net: phase 1 keeps every current calculator assertion green with the old call shape, and each platform keeps its existing write tests (single submit, retry id, month change) until the screen they cover is replaced. | 1, 7, 11, 15 |
| runtime | `net_worth` and PostHog are off on local builds. Web forces the flag through its dev override (`STORAGE_KEYS.DEV_FEATURE_FLAGS`, `posthog.ts:280-296`); iOS through the key `pulpe.feature_flags.net_worth` in the app's sandboxed preferences (`FeatureFlagsStore.swift:5-7`); Android has none today (`feature-flags.ts`: always false without PostHog), so phase 14 adds a local-only one mirroring the web. Guide events are proven by unit specs before merge: turning PostHog on locally would send test events into the production project. After the release, their arrival with `source` is read in PostHog. | 5, 6, 9, 10, 13, 14 |
| regression | Entry buttons disappear from past and future months (`budget-details-page.html:129`, `BudgetDetailsRealizedBalanceSheet.swift:18-33`, `budget-detail-overlays.tsx:330`). `budget-details-page.spec.ts:327` reconciles months 1, 10, 12 and must change. | 6, 10, 14 |
| architecture | New backend module `reconciliation` owning `user_reconciliation` (encrypted starting amount, completion time) and `GET /v1/reconciliation/:budgetId`, `PUT /v1/reconciliation/state`. It reads budgets through `BUDGET_MONTH_READ_PORT`, extended with a read by id. The prior-months correction is a server formula; clients only add it. | 2, 3, 4 |
| architecture | Screen selection, the small-gap threshold, the salary rule, the partly spent budget line and the matched breakdown move into `account-reconciliation.ts` and its Swift twin; Android and web import them, iOS mirrors them. | 1 |
| documentation | `docs/ENCRYPTION.md` and `.claude/rules/05-workflows-and-processes/encryption-backend.md` list the new encrypted column; `docs/BUSINESS_RULES.md` gains the comparison figure rule; `.claude/rules/05-workflows-and-processes/posthog-events.md` needs no change. | 2, 4 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `.claude/rules/00-architecture/formula-mirrors-ts-swift.md` | `account-reconciliation.ts` has a Swift twin: both sides, same fixtures, same commit; a new formula goes server side unless it must run under the finger. |
| CLAUDE.md « ALWAYS encrypt financial amounts » + `docs/ENCRYPTION.md` | The starting amount is a financial amount stored per person. |
| `.claude/rules/05-workflows-and-processes/posthog-events.md` | Three new cross-platform events, declared in `shared/src/feature-flags.ts` and `AnalyticsEvent.swift` together. |
| `.claude/rules/01-standards/storage-access.md` | Web device flags go through `StorageService` with a key and a schema, never raw `localStorage`. |
| `.claude/rules/03-frameworks-and-libraries/transloco-i18n.md` + `catalog-parity.spec.ts` (web, Android) | Every string in fr, en, de, it, fr first. |
| `pnpm test:lexicon` (`.github/scripts/lexicon.test.mjs`) | No « transaction », no formal address, no banking pointing verbs on screen. |
| `ios/.swiftlint.yml` (file 500 strict, type body 300) | `ReconcileAccountsSheet.swift` is at 434 lines; the steps go to their own files. |
| CLAUDE.md scope discipline (~300 net lines) | Each phase is one commit sized to stay near 300 lines of code, tests excluded, so it reads on its own. |
| Vocabulary in CLAUDE.md and spec.md §5 | « Prévue », « Pointé », « payé », never « ajustement ». |

## Decisions

| Decision | Why |
| --- | --- |
| The prior-months correction and the list of their unchecked items are computed by the server (`GET /v1/reconciliation/:budgetId`), not by loading two more budgets on each client. This replaces « le client charge le budget précédent » in Q1. | The formula-mirrors rule sends new formulas to the server unless they run under the finger; the correction is fixed for a comparison, and one server computation replaces three client implementations and four extra fetches. |
| Starting amount and completion live in a new encrypted table `user_reconciliation`, in a `reconciliation` module, not in `/v1/users/settings`. | Settings are read on every launch without the encryption key; adding an encrypted amount there would make every settings read depend on decryption. |
| « First comparison » = no completion stored and starting amount 0. Existing users with a positive gap see the starting-amount question once after release; the screen carries no « Première comparaison » label, so it stays true for them. | Nothing on the server or device records a past comparison today (labels are editable, the « up to date » exit writes nothing). |
| Step 2 waits for the comparison context; when it fails, step 2 shows an error with [Réessayer], writes nothing, and step 1 keeps the typed amounts. | Without `startingAmount`, the prior correction and `hasCompletedComparison`, both the figure and the screen choice are wrong (a person with a starting amount would be offered a wrong « Écart avec mes comptes »). |
| The guide is a page inside the comparison sheet or dialog, seen-flag on the device. | Replaying it from step 1 keeps typed amounts; same storage as the « Mon patrimoine » intro on each platform. |
| Typed amounts are kept in memory only; free account names and sides are kept on the device. | Amounts never touch disk in clear; names are what saves typing next time (Q4). |
| 16 phases, one commit each, on one branch and one PR: phases 1 to 4 first, then web, iOS and Android as three tracks. | The feature reaches `main` in one piece: with 16 PRs, a release cut between two merges would ship a half-redone flow. Each commit stays near the 300-line limit (decisions.md, 2026-11-21). |
