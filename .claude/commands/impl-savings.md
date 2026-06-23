---
description: Implement a Savings Goals scope (PUL-12 / PUL-8 / PUL-285) end-to-end — state reconstruction, tests, adversarial review, business+technical QA, regular commits, PR to preview.
argument-hint: <scope> — e.g. "PUL-12 backend" | "PUL-12 iOS" | "PUL-12 web" | "PUL-8" | "PUL-285"
---

<role>
You are the tech lead implementing one scope of the Pulpe "Savings Goals" epic (PUL-98) end-to-end:
implementation → tests → adversarial review → business + technical QA → PR.
You orchestrate sub-agents and workflows; you do NOT do everything solo.
You remember NOTHING from prior sessions — rebuild state from durable artifacts first.
</role>

<scope>
SCOPE = $ARGUMENTS

Implement ONLY this scope. One reviewable PR. Smallest diff that ships it.
No speculative features, no "while I'm here" refactors. If a decision falls outside SCOPE,
record it under "Follow-ups" in the PR and move on — do not implement it.
If SCOPE is empty or ambiguous, ask which scope before doing anything.
</scope>

<state_reconstruction>
You remember nothing. Before planning, rebuild current state from durable sources, in order:
1. Spec (immutable source of truth): read `docs/SAVINGS.md` (model, link-on-template_line, formulas, edge cases, surface sweep, FX).
2. Real progress: read the Linear issue(s) for SCOPE (PUL-12 and/or PUL-8 / PUL-285) via the linear-server MCP. Checked CA `[x]` = ALREADY DONE — never redo. Unchecked `[ ]` CA within SCOPE = the work.
3. Existing code: `git log --oneline origin/preview..HEAD`, `gh pr list --search savings --state all` — what is merged / open.
4. Implementation journal: read `docs/SAVINGS_PROGRESS.md` — decisions made during prior implementation, gotchas already hit, the recommended "next".
Output a 5-line "current state / remaining for SCOPE" summary BEFORE the plan.
If a checked CA contradicts the actual code, flag it — do not guess.
</state_reconstruction>

<required_reading>
Before any code, also read:
- The Linear issue for SCOPE (its acceptance criteria — CA).
- `docs/diagrams/savings-goals.c4` — business workflows.
- Pattern to replicate per layer: backend → `backend-nest/src/modules/budget-line/**` (Clean Architecture). web → `frontend/projects/webapp/src/app/feature/budget-templates/**` (routing + ziflux store). iOS → `ios/Pulpe/Features/Templates/**` + a `Domain/Services/*Service.swift` actor.
- Repo rules: `CLAUDE.md`, `.claude/rules/05-workflows-and-processes/api-contract-changes.md`, `shared/CLAUDE.md`, `docs/ENCRYPTION.md`.
</required_reading>

<setup>
Work in a dedicated GIT WORKTREE branched from `preview`:
- `git fetch origin && git worktree add ../pulpe-savings -b <issue-gitBranchName>-<layer> origin/preview` (e.g. `…-backend`, `…-ios`).
- `cd ../pulpe-savings && pnpm install`
- WORKTREE GOTCHA: every file edit must target the WORKTREE path, never the main repo.
- SUPABASE GOTCHA: run `supabase start` from the MAIN repo `backend-nest`, NOT from the worktree (kong mounts pin to the start dir).
- iOS GOTCHA: `xcodegen generate --use-cache` only (plain `xcodegen generate` forces a full rebuild).
</setup>

<plan_then_go>
1. Produce a detailed PLAN (phases derived from the unchecked CA of SCOPE + the relevant `docs/SAVINGS.md` sections, files, order, tests to lock) and present it via ExitPlanMode.
2. WAIT for my approval.
3. Once approved: run autonomously through to the PR — regular commits, no further check-ins — unless genuinely blocked.
</plan_then_go>

<how_to_phase>
Derive phases from the unchecked CA of SCOPE. Backend foundation order is always: shared schemas → migrations → RPC propagation → module/use-cases. UI order: data layer (service/store) → screens → wiring → empty/edge states. Commit + green quality gate after each phase.
</how_to_phase>

<known_traps_by_layer>
Carry these forward (found during the validation swarm — do NOT rediscover them):

shared:
- `targetDate`: `z.iso.date()` + `.refine(d => d >= today)`, NOT `.min()` (Zod 4 `.min()` on an ISO string measures LENGTH, not date).
- Removing `priority`: NOT client-breaking (no client sends it) but server-side breaking (DB column is NOT NULL → make nullable before you stop writing it). Follow `api-contract-changes.md`.

backend / DB:
- FK `budget_line.savings_goal_id` has no `ON DELETE` today → DROP then recreate with `ON DELETE SET NULL` (cannot ALTER an ON DELETE). Add `template_line.savings_goal_id` + FK `ON DELETE SET NULL`.
- RG-001 propagation = the big one: `apply_template_line_operations` (SECURITY DEFINER, hardened by PUL-272) + its strict Zod payload schema + `create_budget_from_template` all ignore `savings_goal_id` today. CREATE OR REPLACE + add to the strict schema + propagate from the sync use-case (NON-encrypted field). RE-VALIDATE the PUL-272 cross-tenant guard + atomicity after the rewrite.
- Encryption: `target_amount` via `prepareAmountData`/decrypt; decrypt on LIST + DETAIL, not only progress. Use a DEDICATED FX mapper `mapSavingsGoalCurrencyMetadataToApi` — the field is `original_target_amount` (≠ generic `original_amount`); generic `decryptRowAmountFields`/`mapCurrencyMetadataToApi` target the wrong field → target shows 0.
- Guard: `kind ≠ saving ⇒ savingsGoalId = null` (budget-line create AND update — absent today).
- DELETE goal = unlink linked lines then delete, in one transaction.

formulas (PUL-8):
- `plannedCumulative` = raw Σ `line.amount`, NOT `calculateTotalSavings` (it applies the envelope).
- `calculateRealizedSavings` = clone of `calculateRealizedExpenses` BUT (a) filter `kind==='saving'` strict (not `isOutflowKind`, which sums saving+expense), (b) drop the free-transaction block (`budgetLineId=''`) — a goal has no free transactions.
- `monthsRemaining = indexEcheance − indexCourant + 1` (deadline month is still contributive; ≤ 0 ⇒ overdue → `required`/`paceStatus` null).
- `projected`/`paceStatus` use `confirmedPace` (confirmed-based), so they don't contradict the bar (which is confirmed). `achievementPercent` is on confirmed; guard `targetAmount=0 → 0`.

iOS:
- `BudgetLineUpdate` Swift DTO lacks `savingsGoalId` (tagging-in-edit impossible). The 4 template DTOs lack it too (primary tagging surface). `CurrentMonthTab` is a NavigationStack with no path/destination. The dashboard savings card is HIDDEN when `!hasSavings` → no anchor for the empty-state entry.

web:
- The savings card has no click output and the route `/savings-goals` + store don't exist. Making the card tappable: the interactive element must be OUTSIDE `ph-no-capture` spans (else dead click when amounts hidden).

cross-cutting:
- Surface sweep (see `docs/SAVINGS.md` §9): the link lives on `budget_line`/`template_line`, NEVER on `transaction`. Card entry label = "Voir mes objectifs" (the card stays a MONTHLY summary, not a goal %). Savings never colored amber/red (RG-002).
</known_traps_by_layer>

<orchestration>
- Cross-cutting / migrations / RPC design → `tech-lead` agent before coding.
- Implementation → the matching agent: `backend-developer` / `frontend-developer` / `ios-developer`.
- Lock-tests written in parallel via a workflow or parallel agents while implementation proceeds.
- After implementation, run an ADVERSARIAL review via the `/code-review` skill (or `code-reviewer` agents) on the diff; fix every confirmed finding.
- If CI fails, use the `ci-fixer` skill.
</orchestration>

<tests_to_lock>
Write tests that FAIL on the current state and pass after (Red→Green), scoped to SCOPE. The non-negotiable ones when relevant:
- Contract (shared): `priority` removed; `targetDate` rejects past date.
- DELETE goal → linked lines unlinked, none deleted.
- Kind guard forces `savingsGoalId = null`.
- RG-001 propagation populates `budget_line.savings_goal_id`; `is_manually_adjusted` budgets untouched.
- Encryption round-trip of `target_amount`.
- RLS isolation (incl. cross-month join).
- PUL-272 cross-tenant guard still green after any RPC change.
- (PUL-8) `calculateRealizedSavings` is kind-strict and excludes free transactions; payDay anchor; div/0 guards.
</tests_to_lock>

<qa>
Before the PR, double QA:
- TECHNICAL: `pnpm quality` green; relevant tests green (`cd backend-nest && bun test …` / `cd frontend && pnpm test …` / iOS suite); build OK; types regenerated (`bun run generate-types:local` after any migration).
- BUSINESS: confront the implementation with SCOPE's CA and `docs/SAVINGS.md` — each checked CA is genuinely satisfied (not just "compiles"). Verify INTEGRATION (services wired to UI/controller, mapper called, propagation tested end-to-end), not only compilation.
</qa>

<commits>
- Branch from `preview` (never commit directly on `preview` / `main`).
- Regular commits, one per green phase, conventional messages (`feat(...)`, `test(...)`).
- `pnpm quality` BEFORE every commit (lefthook requires it; in a fresh worktree run `pnpm install` first or the hook fails on missing node_modules).
</commits>

<pr>
When everything is green (quality + tests + review fixed + QA OK):
- `gh pr create --base preview` (target **preview**, NOT main).
- Title: `feat(savings-goals): <scope> (PUL-XX)`.
- Structured description: summary · scope · migrations (if any) · RPC change + PUL-272 re-validation (if any) · CA covered · tests added · "Follow-ups" (remaining steps). Link the issue.
- Do NOT merge. Leave it for me to review.
</pr>

<guardrails>
- Financial amounts ALWAYS encrypted (AES-256-GCM via ENCRYPTION_PORT). Never store `target_amount` plaintext.
- NEVER run a destructive Supabase command (`db reset`, `db push --force`).
- If the diff grows well beyond SCOPE, STOP and report before expanding.
</guardrails>

<handoff>
Before finishing — this is what lets the NEXT run pick up without getting lost:
1. In Linear (`save_issue`), check ONLY the CA genuinely satisfied and verified this run (`[ ]`→`[x]`).
2. Append an entry to `docs/SAVINGS_PROGRESS.md`: `### <YYYY-MM-DD> — <scope>` with: CA checked, non-trivial implementation decisions, gotchas hit, PR link, recommended NEXT step. Update the "Step status" checklist at the top.
3. PR on `preview`; "Follow-ups" = what remains.
4. Reusable gotcha discovered → propose a one-line addition for the project memory / `CLAUDE.md`.
</handoff>

<success_criteria>
- SCOPE's unchecked backend/UI CA implemented AND genuinely satisfied (business check), nothing out of scope.
- `pnpm quality` + relevant tests green; types regenerated if schema changed.
- PR opened on `preview`, full description, not merged.
- Linear CA checked, `docs/SAVINGS_PROGRESS.md` updated — state is durable for the next run.
</success_criteria>
