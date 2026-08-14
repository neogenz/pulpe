# Review: couvrir les lectures de retrait du repository objectifs d'épargne

- **Verdict**: approve
- **Diff**: `aecc6c413^...41147dfce`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_06
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Couvrir les trois lectures de retrait

- [x] Le harnais permet d'asserter table, ids filtrés et filtre de kind sans lire le code de production — `supabase-savings-goal.repository.spec.ts:222-255` expose `table()`, `inArgs()`, `eqArgs()` ; chaque table reçoit désormais la chaîne qu'elle possède (`spec.ts:237`)
- [x] Faire viser `transaction` à `fetchPlannedWithdrawalRows`, ou lui retirer `.eq('kind','income')`, fait échouer un test nommément — mutation `repository.ts:1131` → 47/3 ; mutation `repository.ts:1136` → 48/2 avec `Expected ["kind","income"] / Received undefined`
- [x] Rendre zéro ligne n'appelle pas `getDekFor` — mutation retirant `repository.ts:449` → 49/1, tue `returns empty WITHOUT asking for the DEK…`
- [x] Une erreur Supabase ressort en `SAVINGS_GOAL_FETCH_FAILED` avec l'original dans `cause` — mutation retirant `{ cause: error }` `repository.ts:1147` → 49/1
- [x] Faire viser `budget_line` à `fetchWithdrawalRows` fait échouer un test ; intervertir les deux définitions d'erreur en fait échouer un autre — mutation `repository.ts:1072` → 46/4 ; swap `repository.ts:1080`↔`1140` → 48/2, tue les deux tests d'erreur
- [x] Renommer `budgetLineId` en autre chose dans `toLinkedWithdrawal` fait échouer un test — mutation `repository.ts:1114` → 49/1
- [x] Retirer le `.sort(...)` de `findWithdrawals` fait échouer un test — mutation `repository.ts:470` → 49/1
- [x] Un montant indéchiffrable rend `0` et la lecture aboutit quand même — mutation du repli `0`→`-1` `repository.ts:468` → 49/1, tue `passes 0 as the decryption fallback for an unreadable amount`
- [x] `bun test src/modules/savings-goal` sort en 0, et `bun run quality` sort en 0 — 208 pass / 0 fail sur deux exécutions ; `bun run quality` EXIT=0, spec absente des 44 warnings préexistants

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

None.

## Verification

| Metric        | Value                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (9/9)                                                                                                               |
| Files checked | `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts` (seul fichier des deux commits ; +232/-0 puis +11/-9) |
| Unchecked     | none                                                                                                                     |
| Unplanned     | none — aucune ligne de production touchée ; arbre propre après 16 mutations de contrôle. Les deux findings de la revue précédente sont `fixed` : le trou de filtre sur `fetchWithdrawalRows` (vérifié mort, 46/4 sur la spec et 199/9 sur le module) et le nom de test qui sur-promettait (`spec.ts:1171`) |
