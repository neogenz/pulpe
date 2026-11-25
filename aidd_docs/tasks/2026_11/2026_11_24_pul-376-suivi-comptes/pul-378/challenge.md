My confidence level of correctness now: 85%

# Correctness (100%)
- Server: the account link, the default account and the value rule hold on every write path (create, update, import, spread, template propagation, withdrawal pair), with SQL tests on the 4 migrations and use-case tests with the contract amounts.
- Old clients: iOS 1.14.x and older Android omit `accountId`; the server keeps the account on update (CA26), applies the default on create (CA32), and recognizes their reconciliation gap by its fixed names so it stays without account (CA44), with the limits written in questions.md.
- Web, iOS and Android show the same « Compte » field in the same forms, with « Aucun » visible when empty, the same prefill and CA45 rule, and the same default-account setting, menu entry and badge.
- Final tree green on the four platforms (shared 973, backend 2242, web 3747, Android 1563, iOS 2756), quality gates and `ng build` OK.

# Deal breakers
-

# Suggestions (enhancements only)
- The CA44 name heuristic is a stopgap for installed apps: once iOS 1.14.x and older Android are gone, the name list can be removed and the explicit `null` stays the only rule.
- Android: check on the emulator that the income-from-goal form shows « Compte » cleanly (done during the PUL-379 Android captures).
- CA1 per nature: one form test per nature would turn "read in the code" into a proof; low value, the field does not depend on the nature.
- `user_feedback_rls.sql` counts every row of the table: scoping its final count to the test's own users would make it pass on a shared local database (unrelated to PUL-378).
