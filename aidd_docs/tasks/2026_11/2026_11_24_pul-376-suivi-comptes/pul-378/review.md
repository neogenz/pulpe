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

## UX/UI pass (impeccable critique, web, iOS, Android)

Fresh captures in light, dark and enlarged text in `shots/ux-before/` (local), after the fixes in `shots/ux-after/` (local): `ios-movement-sheet-account-ax5-light.png`, `ios-patrimoine-default-chip-ax5-light.png`, `web-settings-default-account-*.png`, `android-default-account-*.png`, `android-preferences-entry-*.png`. The TalkBack label was checked on a `uiautomator` dump: « Livret Raiffeisen, 12’000.00 CHF, Mis à jour il y a 13 jours, Par défaut ».

Fixed:
- web, P2: « Compte par défaut » is saved on pick but sat above « Annuler / Enregistrer », which do not undo it. Moved under that bar, next to « Langue » (saved on pick too). d6f1246e6, spec asserts the order.
- iOS, P2: the « Compte » field cut the account at accessibility sizes (« Livret Raiff… ») in the movement, « Nouvelle ligne » and prévision sheets: the card reused the goal row and its `lineLimit(1)`. The card now stacks like the Préférences row. be7b9202e.
- iOS, P3: « Par défaut » spilled out of its chip at accessibility sizes: `PulpeChip` had a fixed 36 pt height, now a minimum. 9e7a5cc90.
- Android, P2: TalkBack never read « Par défaut », « Découvert » or « Hors total » on a Patrimoine row: the row's explicit label hid its children. The badges are now part of that label (spec asserts it). Committed inside 19785d2e7: the first commit's hook failed on an unrelated CI-automation test that times out under load, and its staged files went into the next commit.
- Android, P3: the default-account explanation only showed past the last account; now above the list. 19785d2e7.

Rejected, with the reason:
- Android, P3: in Préférences, the « Compte par défaut » row shows the account as its description, where « Jour de paie » has a description and its value on the right. Tried in 093e039a9 and reverted: an account name is free text, and beside the 40 % value column the one-line title and the account were both cut at font scale 1.3 (« Compte par … », « Livret Raiffeis… », `shots/ux-after/android-preferences-entry-dark-1.3.png`). The current row keeps both whole.
- iOS, P3: in the account picker only the selected item is indented (leading checkmark). It comes from `savingsGoalPickerButton`, shared with the goal pickers and older than the epic; changing it is a picker redesign.
- iOS, P3: the « Préférences » subtitle on the Compte screen does not name the default account. It lists the settings as they were before the feature; adding a flag-dependent word is copy, left to Maxime.
- iOS, P1: at the largest text size the movement and « Nouvelle ligne » sheets run off the screen (type, currency and quick-amount rows do not wrap). From c9b5bbeb4, before the epic; the « Compte » field itself now wraps. Follow-up.
- Copy decisions for Maxime, not changed:
  - the conflict message differs: web « Choisis un autre compte : celui-ci est déjà l'élément lié ci-dessus. », iOS and Android « « Compte » et « X » doivent être deux éléments différents. » Picking one sentence for three platforms and four languages is a wording choice; the web one says what to do, the mobile one names the field.
  - « Chaque nouvelle saisie démarre sur ce compte » uses « saisie » for a new movement, while Patrimoine uses it for a typed value (« Ta dernière saisie »).
- Web, detector: the 11 px « Par défaut » chip is the Material label-small step; `nested-cards` and contrast hits are older UI or the dev-only devtools button.
