## PUL-378 planner notes

The planner session was read-only: the orchestrator wrote `plan.md` and the `phase-N.md` files from its output, and `validate-plan.cjs` reports them valid.

## Phases (8, each shippable alone)

1. **Server: the `account_id` link and the value it moves.** Schema, guard trigger, CA25 check, CA46 delete trigger, the read function, the new formula. Existing `asset_id` links switch to the pointed-balance rule here.
2. **Server: writing the account on a movement.** Shared contracts, budget_line and transaction create/update, the `*_with_tags` and withdrawal RPCs, CA4, CA26, CA25 → 400.
3. **Server: template, propagation and spread carry the account.** CA22, CA23, CA31.
4. **Server: default account.** Table, `GET/PUT /v1/users/settings`, defaulting on create, CA35.
5. **Web: « Compte » field** in the forms, prefill, CA25/CA45, CA44 explicit null (web and Android), CA46 local state.
6. **Web: « Compte par défaut » setting** in Réglages, plus the Mon patrimoine menu and « Par défaut » badge.
7. **iOS: « Compte » field** in the 5 forms and reconciliation.
8. **iOS: default-account setting**, menu and badge, plus the pre-PR checks.

Every phase is above the ~300 net LOC limit. Phases 2 and 3 are mostly function bodies copied from the live database with one column added. They are mechanical, but should be reviewed by diffing against `pg_get_functiondef`. If you want fewer phases: merge 3 into 2, 6 into 5, 8 into 7.

## Key decisions

- **Schema.** One column `account_id uuid REFERENCES asset(id) ON DELETE SET NULL` on `budget_line`, `template_line` and `transaction`, each with a partial index.
  - New guard trigger `enforce_account_link()`, a SECURITY DEFINER function with REVOKE, modelled on `enforce_asset_line_link`. It only checks that the line's owner also owns the account. No kind/direction rule, and archived accounts are allowed so editing a line that keeps one does not fail.
  - CA25 is a plain `CHECK (account_id <> asset_id)` on budget_line and template_line. Postgres reports it as error 23514, which is mapped to a 400.
  - All four migrations are **contract**, `safe-after v0.66.2`. The precedent `20261103130000` was contract for the same reasons (inline FK, REVOKE), and the deployed backends ignore the new columns.
- **A movement allocated to a prévision never stores an account.** The formula reads the prévision's account instead (CA4).
  - The server forces null on create and ignores the field on update for allocated movements.
  - A `BEFORE DELETE` trigger on `budget_line` copies the account to the freed movements inside the delete statement (CA46). It only does this if the asset still exists, so deleting a user account (cascade) cannot fail.
- **RPCs to rewrite, bodies taken from the live database:**
  - Phase 2: `update_budget_line_with_tags`, `update_template_line_with_tags`, `update_transaction_with_tags`, `create_savings_goal_withdrawal` and `update_savings_goal_withdrawal` (these two must stay SECURITY DEFINER with the lock; `security_definer_function_privileges.sql` checks it).
  - Phase 3: `create_budget_from_template`, `apply_template_line_operations` (same key-absent semantics as `asset_id`; manually adjusted prévisions untouched), `create_budget_lines_spread`, `create_template_with_lines`.
  - `create_budgets_from_template` and `generate_budgets_from_template` delegate to the leaf function and need no change.
- **Value calculation.**
  - Data comes from one invoker SQL function, `list_asset_movements(p_since)`. Row-level security limits it to the user's rows. It returns ciphertext; the repository decrypts strictly.
  - It returns three kinds of rows: free checked movements with an account checked after the cutoff; linked prévisions where the prévision or one of its movements was checked after the cutoff; and all checked movements of those prévisions.
  - I chose the function over PostgREST queries because the PostgREST version needed an `id.in` list that grows with the gap since the last entry and can hit the URL limit.
  - Formula: `counted(line, t)` = movements checked by t, or `max(amount, that sum)` if the prévision was checked by t. Each prévision becomes positive events (difference between consecutive counts) after the asset's cutoff; a free movement is one event. Events are sorted by check time and debts are clamped at 0 at each step.
  - This gives CA15 exactly (count now minus count at the entry), makes `asset_id` count the same amount as the account, and passes the CA6-of-377 test (Leasing 200 → repayment 300 → 0 → purchase 100 → 100).
  - Signs for `account_id`: on what I own, Revenu +, Dépense/Épargne −; on a debt, Dépense/Épargne +, Revenu −. Signs for `asset_id` are unchanged.
- **Default account storage.** A dedicated table `user_default_account(user_id PK, asset_id NOT NULL)` with a composite FK `(asset_id, user_id) → asset(id, user_id)` `ON DELETE CASCADE` (deleting the account clears it), plus an `AFTER UPDATE OF archived_at` trigger that deletes the row (archiving clears it).
  - Why not `user_metadata`: cleanup would need a service-role write from the asset module, and every create would need a call to Supabase Auth (GoTrue). The table is cheap to read and cleans itself up. The locale preference table is the precedent.
  - `PUT /v1/users/settings` with `defaultAccountId: uuid | null`: null deletes the row; an unknown, foreign or archived id returns 404.
- **Who applies the default.** The server, only when `accountId` is absent on a create of a free movement, a prévision, an additive spread, or a free row in the bank import. The MCP assistant goes through the same use cases.
  - Priority (CA32): allocated follows its prévision, then template line (inside the RPC), then the sent value (null included), then the default.
  - CA45: no default when the default is the line's own `asset_id`.
  - No server default on template lines.
  - New web and iOS always send `accountId` on create (null when the field is hidden), so the default only reaches Android, old iOS, import and the assistant. The reconciliation adjustment sends `null` explicitly on web, iOS and Android (Android is a one-line payload change in phase 5).
  - On update, an absent field keeps the account (CA26).
- **Forms.** One picker component per platform: « Aucun », then « ce que j'ai » and « ce que je dois » groups, hidden when the flag is off or no asset is active. It is reused for the default-account setting.
  - The badge and menu compare `settings.defaultAccountId` with the asset id. Both screens read the same settings store, so a change on one shows on the other without reload.
  - After archiving or deleting an asset, settings are reloaded (CA35).

## Contract points that are ambiguous or contradict the code (prudent choice in brackets)

1. The technical notes list `allocated-transactions/create-dialog/form.ts` among the web forms to change, but it only creates movements allocated to a prévision, so CA4 says no field. [No field there.]
2. Template lines: CA29 says "tout nouveau mouvement est prérempli", but CA30/CA31 protect template lines. [Prefill visible in the web and iOS template forms; no server default on template lines.]
3. The « Remettre sur ton épargne » pair and spreading an existing prévision or movement are not in the listed forms. [No default; a spread takes its source's account.]
4. An `accountId` sent on an allocated movement. [Ignored rather than a 400.]
5. The contract says settings live in `user_metadata`. [Dedicated table, see above.]
6. Flag off on new clients: they send null, so the default does not apply there (CA2 taken literally). Android and old iOS get the default even with the flag off, because the server does not know the flag. [Accepted.]
7. CA42 needs no code. It is covered by the CA27 test (budget unchanged) and the CA41 test (an entry restarts the value).
8. The current rule in `docs/BUSINESS_RULES.md`, "pour leur montant prévu", contradicts the new pointed-balance rule. [Replaced in phase 1.]
9. Not verified against docs: that the `BEFORE DELETE` trigger runs before the FK's `ON DELETE SET NULL`. Phase 1's SQL test proves it.

I did not check two existing refresh paths, and the plan lists both as checks: the web net-worth cache invalidating after a quick-add from the current-month screen, and the iOS `AssetStore` refreshing after a check.
