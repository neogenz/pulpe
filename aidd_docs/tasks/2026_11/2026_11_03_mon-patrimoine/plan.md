---
objective: "On the web, a user declares assets and debts in CHF or EUR, sees today's net worth as a Sankey, refreshes in-Pulpe balances from the reconciliation, and links prévisions to assets that propose their new value."
status: implemented
---

# Plan: Mon patrimoine (web)

Source: [`brainstorm.md`](./brainstorm.md), web only (frontend, backend-nest, shared), steps 1 and 2.

## Phases

| #   | Phase                                      | File                         | Depends on |
| --- | ------------------------------------------ | ---------------------------- | ---------- |
| 1   | Asset tables and rekey safety net          | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Asset API and net-worth totals             | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | « Mon patrimoine » page                    | [`phase-3.md`](./phase-3.md) | 2          |
| 4   | Reconciliation refreshes in-Pulpe assets   | [`phase-4.md`](./phase-4.md) | 3          |
| 5   | Prévisions linked to an asset              | [`phase-5.md`](./phase-5.md) | 2, 3       |
| 6   | Value suggestions from checked prévisions  | [`phase-6.md`](./phase-6.md) | 3, 5       |
| 7   | Income drawn from an asset                 | [`phase-7.md`](./phase-7.md) | 5, 6       |

## External sources

| URL                                                  | What it settled                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| https://chartjs-chart-sankey.pages.dev               | Sankey data shape (`from`, `to`, `flow`), `colorFrom` / `colorTo`, node `labels`, registration through `Chart.register` |
| https://github.com/kurkle/chartjs-chart-sankey       | `SankeyController` and `Flow` are the two registrables; peer `chart.js >= 3.3.0`, matching the installed 4.5.1           |
| https://registry.npmjs.org/chartjs-chart-sankey      | 0.19.1 is the latest release (2026-09-12) and has no runtime dependencies                                               |
| https://registry.npmjs.org/d3-sankey                 | Last release in 2019, rejected in favour of the Chart.js plugin already compatible with `ng2-charts`                    |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | FX comes from the existing `CurrencyService` (Frankfurter, 24h in-memory cache, stale fallback), observed in `backend-nest/src/modules/currency/currency.service.ts`; a cold outage leaves a foreign asset unconverted, so totals carry an `incomplete` flag. The PostHog flag `net_worth` does not exist yet in PulpeProd: unverified. Locally the flag is forced through the `pulpe-dev-feature-flags` localStorage override read first by `isFeatureEnabled` (observed, `core/analytics/posthog.ts:211-217`). Sankey rendering inside `ng2-charts` under zoneless Angular: unverified until phase 3 runs it. | 2, 3 |
| regression    | High: the rekey RPC used by PIN change and recovery gains a table. Covered by `aes-gcm.crypto-service.spec.ts`, `supabase-encryption-key.repository.spec.ts`, `change-pin.use-case.spec.ts`, `recover-with-recovery-key.use-case.spec.ts` and the SQL test `rekey_plan_withdrawal_rolling_deploy.sql` (all observed); safety net yes, phase 1 runs them green before changing the rekey. | 1 |
| regression    | Medium: the reconciliation dialog gains pre-filled rows and a completion side effect, and its opener moves into a dialog service used by `current-month.ts` and `budget-details-page.ts` (observed, the only two callers). Existing coverage: `reconcile-accounts-dialog.spec.ts` and `frontend/e2e/tests/features/account-reconciliation.spec.ts` (observed). Safety net no: the existing cases run unchanged with the flag off and act as the regression lock. | 4 |
| regression    | High: seven RPCs copy or rewrite prévision columns and must carry `asset_id`, observed by their explicit column lists. Bodies: `create_budget_from_template` (`20260724120000`), `generate_budgets_from_template` (`20260901120000`), `apply_template_line_operations` (`20260727122000`), `create_budget_lines_spread` (`20260626120000`), `create_template_with_lines` (`20260715130000`), `update_budget_line_with_tags` and `update_template_line_with_tags` (`20260715140000`). `20260814122000` later switched the third, fourth and fifth to SECURITY INVOKER, so a redefinition from the migration file alone would bring back DEFINER. Safety net yes: phase 5 takes each body from `\sf` on the local DB and adds a SQL test before the change. | 5 |
| regression    | Medium, cross-client: `budgetLineSchema` and `templateLineSchema` gain a required nullable `assetId`, as `savingsGoalId` is (`shared/schemas.ts:972`, `:1997`). Typed literals break: Android `current-month-view-model.ts:130` and eight Android specs, run by `tsc --noEmit` in Android `quality` (observed); web `testing/mock-factories.ts`, `e2e/mocks/api-responses.ts`, `e2e/helpers/api-mocks.ts` and specs (observed). iOS decoding ignores unknown keys (standard `Decodable` behaviour, not run). Clients that PATCH without `assetId` must keep the link: unverified until phase 5's test. | 5 |
| privacy       | The three new tables hold financial data: RLS per user and an encrypted value (phase 1). Logout clears every domain cache in `core/auth/auth-cleanup.service.ts:43-53` (observed); the new `assets` cache must join it, or the next account in the same browser sees the previous net worth. No analytics event carries an amount or a label. | 1, 3 |
| architecture  | New backend module `asset` on the three-layer pattern of `modules/tag`, reaching FX through its own `EXCHANGE_RATE_PORT` instead of importing `CurrencyService` (`nestjs-architecture.md` « Use ports, never direct Service→Service imports »). New web `core/asset/asset-api.ts` shared by `feature/net-worth`, `pattern/reconcile-accounts` and `pattern/asset-picker`. `budget_line` and `template_line` gain a second optional link, `asset_id`, beside `savings_goal_id`, with no coupling between the two. | 2, 3, 5 |
| documentation | `docs/BUSINESS_RULES.md` gets a Patrimoine section, including the today's-rate exception to the frozen-rate rule. `docs/ENCRYPTION.md` and `.claude/rules/05-workflows-and-processes/encryption-backend.md` list `asset_snapshot.value` and the rekey v3. The table list in `cleanup-expired-deletions.use-case.ts` JSDoc gains the three tables. | 1, 3, 5, 6 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Encrypt `amount`-like columns via `ENCRYPTION_PORT`; a new encrypted table joins the rekey (`docs/ENCRYPTION.md`) | `asset_snapshot.value` is a financial amount; missing it from the rekey loses data on PIN change or recovery |
| Migration header `-- pulpe:migration-phase expand\|contract`, contract needs `-- pulpe:safe-after vX.Y.Z` (`.github/scripts/check-migration-contract.cjs`) | Every phase that touches the schema writes a migration; REVOKE and inline FK are contract-only |
| After a schema change, `bun run generate-types:local` then `bun run format` | Phases 1, 5 and 6 change the schema; the generator emits code Prettier rejects |
| Never destructive Supabase commands on a linked DB; locally only `bun run supabase:reset`, started from the main repo | SQL tests in phases 1 and 5 need a local reset |
| Cross-module calls go through ports (`.claude/rules/00-architecture/nestjs-architecture.md`); a written rule beats the precedent next to it | The asset module needs FX; existing use cases that import `CurrencyService` directly are not copied |
| A new formula belongs server side; `shared/src/calculators/` changes mirror in Swift (`formula-mirrors-ts-swift.md`) | Totals, category subtotals, converted values and suggestions are computed in the backend; the web only displays them |
| `import * as z from 'zod'`; one endpoint, one named schema | New shared schemas in phases 2, 5 and 6 |
| Removing or adding a required schema field breaks `frontend/e2e/` mocks too | `assetId` joins the read schemas in phase 5 |
| PostgREST caps reads at 1000 rows: use `fetchAllPages` | Snapshot and checked-line reads grow without bound |
| The word « transaction » never shows on screen (`pnpm test:lexicon`); vocabulary « prévisions », « Pointé », « Épargne », copy in « je » | All new French copy |
| `AppCurrencyPipe` with `1.0-0` for aggregates and `1.2-2` for lines; never concatenate the currency | Totals, Sankey labels and asset rows |
| Angular templates are only type-checked by `ng build` | Every web phase runs `ng build` before done |
| `ANALYTICS_EVENTS` owns event names; feature flags live in `FEATURE_FLAGS` (`shared/src/feature-flags.ts`) | The rollout flag `net_worth`; no new analytics event is planned |

## Decisions

| Decision | Why |
| -------- | --- |
| Three tables: `asset_category`, `asset`, `asset_snapshot`; only `asset_snapshot.value` is encrypted, and the latest snapshot is the current value | History is the sequence of dated snapshots the brief asks for; one encrypted column keeps the rekey surface small |
| A debt is an `asset` with `direction = 'owe'`, valued by what remains due; an `own` value may be negative (overdraft) and counts on the debts side | One model for assets and debts, as the brief settles |
| Every money figure (converted values, category subtotals, gross, debts, net, suggestions) is computed in `backend-nest/src/modules/asset/domain/asset.formulas.ts`; the web Sankey only maps those figures to flow widths | One source of truth, no TS↔Swift mirror owed while the feature is web only; iOS will read the same figures |
| Foreign values convert at today's rate on every read through `EXCHANGE_RATE_PORT`; a missing rate leaves the asset out of the totals and sets `incomplete` | The brief accepts the exception to the frozen-rate rule; a silent zero would understate the fortune |
| New rekey RPC `rekey_user_encrypted_data_with_asset_snapshots`; the v1 and v2 entry points fail closed when the user has snapshots | Same rolling-deploy guard as `savings_goal_plan_withdrawal`: an old backend must never rekey half the data |
| Deleting a non-empty category is refused (FK `RESTRICT`); an archived asset keeps its history and leaves the totals | User answers to the open questions |
| Starter categories are suggestions, not rows: the category field offers the six translated names not yet used, and one becomes a real category only when an asset is saved in it. | User answer: creating them d'office would need a « seeded » marker, otherwise deleting them all brings them back; suggestions keep every created category renamable and deletable for good, and come in the user's language |
| `asset_id` on `budget_line` and `template_line`, chosen on each prévision, independent from `savings_goal_id`; a trigger enforces tenant and kind↔direction (saving→own, income→own, expense→owe) | User answer: the asset is chosen per prévision; the DB is the only writer-agnostic guard |
| An expense never changes an `own` asset; an expense linked to a debt (its instalment) lowers what remains due. | User answer, confirming the brief's hypothesis: it reconciles « une dépense ne compte jamais » (step 2) with the hypothesis on debt instalments; dropping it means removing expense→owe from the trigger |
| Suggestions are computed on read from checked linked prévisions; a dismissal stores `asset.suggestion_dismissed_at` and the dismissed movements are forgotten: the next suggestion counts only prévisions checked after it. | User answer: dismissing says the proposal is wrong; carrying it into the next one would repeat it. No suggestion table to keep in sync |
| « Mon patrimoine » is a main-nav entry after « Objectifs d'épargne », gated by `FEATURE_FLAGS.NET_WORTH`; the route itself is not guarded. | User answer for the placement. No flags-ready signal exists to guard on. During the rollout a user with diagnostics off never sees the entry, an accepted cost of a temporary flag |
| Income from an asset is one more choice of the web revenue-origin switch, on the create dialog only; the edit dialog shows it read-only like the savings-goal source | User answer: after the switch ships. The switch exists only on create (`2026_10_20_revenue-origin-switch/phase-3.md`), and the edit dialog already treats an origin as read-only (`edit/dialog.ts:164-175`) |
