# Review: PUL-378 — un compte sur chaque mouvement, et un compte par défaut

## Round 1 (phases 1-8, web and iOS)

Independent review on the server, web and iOS phases. Findings and outcomes:

- should-fix, web: the reconciliation gap from the budget page did not send `accountId: null` (CA44). Fixed in a968936d6, test fails without the fix.
- nit, iOS: the account prefill ran again when the field reappeared. Fixed in 9aa8737c4 (the sheet owns the flag).
- iOS `AddTemplateLineSheet` without « Compte »: kept, questions.md Phases 7-8 decision 5.
- Conflict message wording differs between web and iOS: not changed.
- « saisie » vs « mouvement » in the default-account hint: not changed, the text was imposed by the supervisor.

## Round 2 (final tree 82a5b4a41, all four platforms)

Diff `470aa95a7..82a5b4a41`. Verdict: changes requested, nothing blocking.

- should-fix, web: « Compte » shown on « Remettre le mois prochain » and the choice dropped (the withdrawal pair carries no account). Fixed in 27ec01803: hidden, as on iOS. Test fails without the fix.
- should-fix, Android: « Compte » hidden on an income drawn from a goal, the default applied with no choice. iOS and web keep the field. Fixed in 5f39f99ef, test fails without the fix. Not checked on the emulator: same component as the other modes.
- nit, server: the JSDoc of `resolveSourceSavingsGoalId` was split from its function by the CA44 helpers. Fixed in 9d90b61aa.
- nit, web vs iOS, CA45: the web freed « Compte » even when it was picked by hand. The contract frees only the prefilled one. Web aligned on iOS in 27ec01803, tests fail without the fix.
- nit: out-of-scope edits (web sticky footer spacing, Android `dismiss-suggestion` removal and intro copy). Kept: the footer fix keeps the « Compte » field's text out from under the bar, and the Android edits are recorded in questions.md Android 7-8.
- Noted, not changed: an already-installed Android that undoes the deletion of a free movement re-creates it without `accountId`, so the default account applies. Current Android sends the account back (questions.md Android 4).

Checked and found correct by the reviewer: the 4 migrations (contract header, safe-after v0.66.2, RPC bodies diffed against their previous definitions, SECURITY DEFINER/INVOKER modes, grants, RLS), the value formula, CA4/CA26/CA32/CA45 on the server, the old-client compatibility, cache invalidation, i18n key parity (web, Android, iOS xcstrings).

## Validation

Every CA proven, gaps and their outcomes in [validation.md](./validation.md).
