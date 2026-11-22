# Codebase Audit: « Comparer avec mes comptes » (PR #935)

Sound feature: no critical finding. The majors are one data bug on Android, accessibility gaps, a slow context read and logic copied across platforms.

- **Date**: 2026_11_22
- **Scope**: `shared/src/calculators/account-reconciliation.ts`, `backend-nest/src/modules/reconciliation/`, `frontend/.../pattern/reconcile-accounts/`, `ios/.../CurrentMonth/Reconciliation/`, `android/src/features/current-month/` (reconcile*), branch `claude/reconciliation-onboarding-redo` against `origin/main` plus the uncommitted tree
- **Health**: good
- **Findings**: 0 critical, 10 major, 37 minor (details and evidence in the pillar files beside this one)

## Findings

Majors in full; minors grouped. Line numbers are those of the pillar reports and may have moved since.

| Sev | Category     | Location | Issue | Suggested fix | Effort |
| --- | ------------ | -------- | ----- | ------------- | ------ |
| 🟡 | ui | `android/.../reconcile-starting-amount-sheet.tsx:66` | The starting-amount editor drops the minus: a −500 set on web is saved as +500 after one keystroke | Signed field like the step-1 row, plus a spec | S |
| 🟡 | ui | `ios/.../ReconcileCompareStepView.swift:427` | « Oui, noter … » forced to one line: at accessibility sizes the amount is what gets cut | `lineLimit(nil)` at accessibility sizes | S |
| 🟡 | ui | `frontend/.../reconcile-compare-step.ts:393` | The struck old figure is read as a second amount by screen readers | `aria-hidden` on `<s>` + sr-only « au lieu de » | S |
| 🟡 | performance | `backend-nest/.../get-reconciliation-context.use-case.ts:41` | About 17 queries over 10 sequential round trips per context read (code reading, not measured) | Read the current budget once; deeper rewrite after a measurement | S / M |
| 🟡 | architecture | `frontend/.../reconcile-accounts-step.ts:59` | « Sur tes comptes » computed by two TS copies; shared `summarizeAccounts` ignores sides while its Swift twin applies them | Shared `summarizeAccounts` taking sides | M |
| 🟡 | architecture | `frontend/.../reconcile-compare-step.ts:116` | `buildComparison` copied in Android, third version on iOS; copies already drift | Move the pure builder into shared, iOS as declared twin | M |
| 🟡 | tests | `frontend/.../reconcile-accounts-dialog.spec.ts:715` | No web test for a second click while a check is in flight (toggle API would uncheck) | One-call assertion | S |
| 🟡 | tests | `android/.../reconciliation.spec.ts:136` | « Voir les {n} autres » count untested on Android | Fixture with a movement under a checked prévision | S |
| 🟡 | tests | `android/.../reconciliation-queries.spec.ts:1` | Jest never exits when this spec runs alone | Test-local `QueryClient`, unmount before clear | S |
| 🟢 | code-quality | `shared/.../account-reconciliation.ts:213` and Swift twin | Dead `pointingCandidates`, `pointingEffect`, `SMALL_GAP_THRESHOLD` export | Delete, keep the cases on `rankedPointingCandidates` | S |
| 🟢 | code-quality | web `SuggestionRow.kind`, iOS `isNegative`, iOS before-checks pair, Android period math, backend entity name, controller comment, token location | Naming and small duplication drift (7 rows) | See `code-quality.md`, `architecture.md` | S |
| 🟢 | performance | iOS `ReconcileAccountsFlow.swift:305`, Android `toggle-check-mutation.ts:110`; web `reconcile-accounts-dialog.service.ts:14` | Context re-read after every check; dialog chunk loaded eagerly | Re-read for prior items only; dynamic `import()` | S |
| 🟢 | ui | 10 rows across the three clients | VoiceOver focus in the guide, invalid caption, « Solde » label, masked sentences, state card, help block, chips, token drift, icon sizes, typography | See `ui.md` | S |
| 🟢 | tests | 11 rows across the three clients | Uncovered branches (« Il y a 2 mois », positive-gap texts, sign-out clearing, guide seen rule), test hygiene (act overlap, fake timers, e2e clock) | See `tests.md` | S |
| 🟢 | architecture | `frontend/.../reconcile-accounts-dialog.ts:293` | Pre-existing: checks go through a toggle endpoint, so a stale context could uncheck | Idempotent check endpoint if ever reported | M |

Security and dependencies: no finding (`security.md`, `dependencies.md`).

## Top actions

1. Fix the Android starting-amount sign and the iOS « Oui, noter » truncation (ui majors). Handed to the platform agents.
2. Web screen-reader « au lieu de », the « Solde de {nom} » label, guide focus and the remaining ui minors. Handed to the platform agents.
3. Backend: read the current budget once and drop `budgetExists`; token, entity name and comment cleanups. Done.
4. Shared and Swift dead code. Done on the TS side; the Swift side is with the iOS agent.
5. Missing tests and hygiene from `tests.md`, then re-check iOS and Android in the re-read-only-for-prior-items change. Handed to the platform agents.
6. Deferred to a follow-up, with no user-visible effect today:
   - move `buildComparison` and a side-aware `summarizeAccounts` into shared;
   - measure the context read, then rewrite it;
   - unify the help block, chips and retry-button styles.

## Coverage

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests, ui
- **Skipped**: none. Not run by the auditors: runtime timings (machine load), iOS suites during the tests audit (simulators busy), Playwright e2e.
