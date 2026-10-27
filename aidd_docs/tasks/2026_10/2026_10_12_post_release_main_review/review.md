# Main review since v0.51.1

Date: 2026-10-12. Baseline: `bc701ffc7da2b7546aad76a94b5014b914d17a8a`.
Reviewed head: `b4f8a1f56be88e3a3f9d370c37465e01519a45fa`.
GitHub confirmed both the latest published release and the current main head.

Verdict: fix finding 1 before enabling bank imports. Fix finding 2 before relying on green CI. The remaining findings concern money presentation, product vocabulary, UI affordances, and design-system consistency.

The eight integrated PRs add bank-statement imports, redesign web settings, add weekly iOS recaps and their analytics, extend feedback to the web, distinguish onboarding pauses, revise landing copy, and clean up recaps at session end. The combined diff contains 150 files, 10,252 insertions, and 905 deletions. No production source was changed during this review.

## Scope

| PR | Change | Review focus |
| --- | --- | --- |
| #765 | Bank-statement imports | Parsing, deduplication, encrypted insertion, ownership, attachments, period filtering, recovery, UI and copy |
| #779 | Web settings | Form validation, password/PIN confirmation policy, connection activity, accessible labels, layout and tokens |
| #780 | Weekly iOS recap | Period arithmetic, opt-in, privacy, scheduling, notification copy and tests |
| #783 | Landing copy | Product claims, wording and translation parity |
| #782 | Recap analytics | Event parity and navigation after notification taps |
| #781 | Feedback collection | Account status, invitation cadence, presentation gates, submission outcomes, privacy and platform parity |
| #785 | Onboarding pause tracking | Pause versus abandonment semantics and shared event contract |
| #784 | Session-end recap cleanup | Cancellation generations, session boundaries and cleanup ownership |

Review authority: supplied AGENTS.md, PRODUCT.md, root and platform DESIGN.md, business rules, encryption documentation, and adjacent callers/tests. Expected scale: normal personal budgets, with the import's explicit ceilings of 2 MiB and 1,000 bank entries. This is a source review with targeted execution, not a full security audit or rendered UI certification.

## Must fix

### 1. [P1] A grouping reference silently drops distinct bank credits

Location: `backend-nest/src/modules/transaction-import/infrastructure/parsers/camt053.parser.ts:121-124` (#765).

What this is: the parser chooses `NtryRef` as the bank operation's identity when the entry-level `AcctSvcrRef` is absent. It chooses it even before a unique `TxDtls/Refs/AcctSvcrRef`.

Problem: Swiss `NtryRef` can be a QR-IBAN or another grouping identifier, rather than a unique booking reference. `fingerprintMaterials` then ignores date, amount and label. `classifyOperations` classifies subsequent distinct credits under that identifier as already imported, including credits from later exports.

Verification: executed the real parser, validation, fingerprint-material and classification functions on two valid booked credits, dated October 1 and 2, for CHF 10 and 20. Both had the same QR-IBAN `NtryRef`, but different transaction-level `AcctSvcrRef` values. There were no validation errors. Result: `[new, already_imported]`, creating CHF 10 instead of CHF 30.

Smallest fix: use genuinely unique account-servicer references, preferring the entry-level reference and then the single-detail reference. Use the existing content fallback when neither exists; do not use `NtryRef` alone as a unique identity. Add one regression test for this case, including a later export. Review migration of any previously persisted fingerprints separately from changing the algorithm, so reimports do not duplicate existing rows.

If skipped: legitimate movements disappear from the import and financial totals are understated. The feature flag reduces exposure but does not fix the parser.

Source: [SIX Swiss Payment Standards 2025, sections 4.3.1–4.3.2, pages 29–30](https://www.six-group.com/dam/download/banking-services/standardization/sps/business-rules-sps-2025-fr.pdf). These sections define `NtryRef` grouping variants, including a QR-IBAN. [SIX developer specifications, page 31](https://www.six-group.com/dam/download/banking-services/interbank-clearing/de/standardization/iso/swiss-recommendations/implementation-guidelines-camt-developer_support-2022.pdf) identify `AcctSvcrRef` as the unique booking reference used for duplicate checks.

## Should fix

### 2. [P2] The new fingerprint test fails randomly on valid hashes

Location: `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:253-259` (#765).

What this is: the suite creates a random master key, then asserts that its hexadecimal HMAC cannot contain `42`, because the original amount contains those digits.

Problem: `42` is a valid random substring of a hexadecimal hash. Its occurrence does not reveal the original amount. The assertion rejects correct cryptography.

Verification: the assertion failed in both review runs. In the first run the valid HMAC was `08692ef53cef1b07802289df05342ac090aee7c2b276e5ec9024d89c2ef0b2ba`. After updating dependencies and allowing the HTTP tests to bind a local port, the combined backend run reported 187 passes and this single failure.

Smallest fix: delete the substring assertion. Retain deterministic output, exact hash format, and variation by user/material/master key. Use a fixed test key for repeatable fixtures.

If skipped: CI and local checks can fail without a regression, encouraging unreliable reruns.

### 3. [P2] A positive weekly allowance can be displayed as zero

Location: `ios/Pulpe/Domain/Services/NotificationScheduler.swift:180-187` (#780).

What this is: the recap chooses the positive-allowance sentence using the full Decimal, but formats that allowance with `asCompactCurrency`, which rounds to whole currency units.

Problem: for a positive allowance of CHF 0.25, the copy says "Cette semaine : environ 0 CHF à dépenser". It contradicts the state used to choose the sentence and the Honest Amount Rule. The same formatter also hides cents in the usual-spending comparison.

Verification: traced `weeklyRecapBody` through `Decimal+Extensions.swift:50-58` and `Formatters.amountFormatter`, which sets both fraction-digit counts to zero in whole-number mode. Existing recap tests cover large amounts and exactly zero, not positive sub-unit allowances.

Smallest fix: preserve cents for small positive allowances and habit amounts with the existing adaptive formatter, or explicitly describe amounts below the smallest displayed unit. Add a positive sub-unit regression case.

If skipped: the notification communicates an exhausted allowance when some money remains.

### 4. [P2] Bank-import copy uses an aggregate label for individual objects

Location: `frontend/projects/webapp/public/i18n/fr.json:2068,2125,2130-2132` (#765).

What this is: the new flow says "un Réel", "Réel libre" and "Réels libres" for imported objects.

Problem: the supplied vocabulary reserves "Réel" for the aggregate opposite "Prévu". Individual objects use their nature or a verb; collections use "Mouvements". The flow mixes that internal object name with "opération" and "mouvement", including a success message that already uses the correct vocabulary.

Verification: checked the new French catalog and the strings consumed by the dialog. `test:lexicon` passes because it catches forbidden words and address forms, not this semantic misuse.

Smallest fix: use "mouvement" or its nature and say "sans prévision, à pointer" when explaining a free movement. Update the corresponding translations together; retain "Réel" on aggregate labels.

If skipped: this feature teaches a different vocabulary from the rest of Pulpe.

### 5. [P2] The settings disclosure has a 24 px touch target

Location: `frontend/projects/webapp/src/app/feature/settings/settings-page.ts:201-206` (#779).

What this is: "Comment ça fonctionne" is now an interactive native summary, styled with `min-h-6` and label typography.

Problem: at the normal root size, its minimum height is 24 px, below the app's 44–48 px control target. The surrounding details padding is outside the summary's clickable element. The adjacent connection-setup disclosures already use `min-h-11`.

Verification: source inspection found no global summary rule expanding the target. A rendered measurement on mobile was not performed.

Smallest fix: use the established `min-h-11` or a 48 px summary target. Keep the native keyboard/focus behavior.

If skipped: opening the explanation is unnecessarily difficult on touch screens.

## Minor consistency fixes

### 6. [P3] Import reason chips bypass the design-system components

Location: `frontend/projects/webapp/src/app/feature/budget/budget-details/transaction-import/transaction-import-dialog.ts:385-390` (#765).

What this is: suggestion reasons are raw list items assembled from a rounded capsule, custom padding, fill and small text.

Problem: the cross-platform Chip Composition Rule prohibits ad-hoc feature chips. Their size and typography also differ from the existing Material chip vocabulary.

Smallest fix: render reasons with non-interactive Material chips, preserving the accessible reason-list label. Do not introduce another feature-specific badge abstraction.

If skipped: future DS changes will not reach these badges.

### 7. [P3] A shared Zod validation message is French

Location: `shared/schemas.ts:1931-1935` (#765).

What this is: the duplicate-decision refinement emits "Une opération ne peut être rattachée qu’une fois."

Problem: supplied AGENTS.md explicitly requires shared/frontend Zod errors to remain English. This schema can be executed for any supported interface language; an untranslated French validation message violates that boundary.

Smallest fix: use an English internal validation message and keep localized user-facing explanations in the UI catalogs.

If skipped: error handling and localization conventions diverge at a shared trust boundary.

## What is coherent

- Import code follows backend ports/use cases and the route-scoped Angular store/API pattern. The bank XML parser stays out of the frontend bundle.
- Ownership is checked before budget-line reads. All imported amounts pass through ENCRYPTION_PORT; the deduplication digest is user-scoped. The write is one SQL insert, and a unique index protects concurrent imports.
- Attachments require explicit decisions. Savings withdrawals are excluded, and attaching a debit to an ordinary savings forecast changes its recorded kind. Tests cover refusal of incompatible attachments and stale decisions.
- The new password/PIN flows follow consequence-matched confirmation: one recoverable account password, confirmed encryption PIN, and no dialog dismissal during PIN rekeying.
- Feedback status exposes only the account's submission state. Input masking protects web comments, explicit analytics do not send comment text, and submission cannot also count as cancellation. iOS checks its live presentation gate after the status request.
- Weekly recap remains a separate opt-in. The final reviewed head includes #784: pending and delivered recaps are cleared at session boundaries, and cancellation generations invalidate in-flight schedules. Earlier review findings fixed by that PR are not repeated here.
- Onboarding backgrounding is now a pause on iOS; confirmed exits remain abandonment. Shared analytics names are mirrored.
- Landing changes retain translation shape and product claims. No changed financial formula in the existing shared/Swift mirrors was found.
- Payday-aware import filtering is correct. The parent budget page already displays its period bounds; the missing duplicate range inside the import dialog was therefore excluded from the final findings.

## Verification

| Check | Result |
| --- | --- |
| Published release / current main | Confirmed through GitHub connector; local head matches remote |
| Shared build | Passed |
| Shared import and feedback schemas | 22 passed |
| Product lexicon | 12 passed |
| Migration-contract test suite | 10 passed; this is not an execution of the new migrations against PostgreSQL |
| Angular targeted unit tests | 168 passed across 11 files, after rebuilding shared |
| Backend import and crypto tests | 187 passed, 1 failed: finding 2; HTTP tests passed after allowing a temporary local listener |
| Landing accessibility and dictionaries | 75 passed using Node's test runner with tsx import; avoided the CLI's sandbox-blocked IPC socket |
| Reproduction of finding 1 | Confirmed against real parser/classification code |
| UI source detector on changed dialogs/settings | No findings emitted; manual DS inspection found issues the detector misses |
| Angular application build | Passed with Node 24 and two workers outside the sandbox; strict templates compiled. Initial sandboxed builds aborted in esbuild and are not reported as merge regressions |
| iOS targeted suites | 128 passed in 7 suites, including app/widget compilation, after regenerating the ignored local Xcode project with XcodeGen |

Total: 602 passing tests and the one confirmed flaky assertion in finding 2. Passing existing tests does not cover the reproduced bank-reference collision in finding 1.

Not checked: rendered desktop/mobile layouts, dark appearance, VoiceOver/Dynamic Type on a device, delivered notifications, a real bank export, live DB migration execution, and end-to-end tests against a running Pulpe backend. The existing localhost:4200 server belonged to another app and was not used as Pulpe visual evidence.

No fixes, release actions, external comments, or tickets were created. The pre-existing staged CLAUDE.md change was left intact.
