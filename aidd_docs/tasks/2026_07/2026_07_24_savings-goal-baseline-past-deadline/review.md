# Review: borner la baseline d'un objectif d'épargne à son échéance (PUL-311)

- **Verdict**: approve
- **Diff**: `preview...maximedesogus/pul-311-arreter-les-previsions-epargne-dun-objectif-a-sa-date`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_25
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 1 — borner la propagation à la création de l'objectif

- [x] Les deux specs échouent contre le code actuel et nomment la période fautive — `bulk-template-line-operations.use-case.spec.ts:34-44` (fixture 4 budgets dont 11/2026 et 01/2027) et `create-savings-goal.use-case.spec.ts:107-117` ; rouge prouvé en retirant les 4 fichiers source : 3 fail / 12 pass
- [x] Le bulk endpoint HTTP existant propage toujours à tous les budgets futurs — `budget-template.controller.ts:332-336` inchangé, paramètre optionnel `bulk-template-line-operations.use-case.ts:56`, filtre sauté sans borne `:168-170`
- [x] Créer un objectif échéant dans 3 périodes pose la prévision de la période courante à l'échéance et sur aucune au-delà — `create-savings-goal.use-case.ts:105-117`, relais `template-line-propagation.adapter.ts:38`, `<= maxIndex` à `bulk-template-line-operations.use-case.ts:171-173`
- [x] `docs/SAVINGS.md` §3.5 énonce la borne d'échéance — `docs/SAVINGS.md:88`

### Phase 2 — borner la génération mensuelle des budgets

- [x] Le test d'intégration échoue contre la RPC actuelle et passe après la migration — `savings-goal-propagation.integration.spec.ts:770-867`, 9 pass / 0 fail contre le Postgres local ; rouge par PGRST202 (argument nommé irrésoluble sur la fonction 5-arg)
- [x] Un appel sans le nouveau paramètre produit exactement le budget d'avant — corps identique à `20260720120000` hors `DECLARE` et conjonction ajoutée ; `create-template-with-tags.integration.spec.ts:121-140` (rôle `authenticated`, appel 5-arg) passe, ce qui prouve aussi le rétablissement des GRANTs
- [x] Un budget matérialisé après l'échéance ne porte aucune prévision liée, les autres lignes sont là — `savings-goal-propagation.integration.spec.ts:239-240`, objectif laissé `ACTIVE`
- [x] Un budget matérialisé pour la période d'échéance elle-même porte bien la prévision liée — comparaison stricte `<` à `supabase-budget.repository.ts:541-550`, verrouillée par `supabase-budget.repository.spec.ts:374-393`
- [x] `docs/SAVINGS.md` §6 mentionne l'arrêt par échéance à côté de l'arrêt par statut — `docs/SAVINGS.md:211`

## Findings

| Sev | Kind | Phase | Location                                                        | Issue                                                                                                                                                                                          | Fix                                                                                                                                              |
| --- | ---- | ----- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢  | rot  | 2     | `backend-nest/.../savings-goal-propagation.integration.spec.ts:842` | Le commentaire et les identifiants `withinHorizon*` affirmaient que 4/2099 est « encore dans l'horizon » ; l'échéance du fixture est `2099-01-01`, donc 4/2099 est **aussi** post-échéance. L'assertion est juste, sa justification est inversée — le lecteur suivant s'y fierait. | Appliqué : commentaire réécrit sur le vrai mécanisme (argument omis ⇒ comportement pré-PUL-311, la décision d'horizon appartient à l'appelant) et identifiants renommés `omittedArg*`. |
| 🟢  | code | 2     | `backend-nest/.../supabase-budget.repository.ts:520`               | `fetchGoalIdsPastTarget` appelait `getPayDayOfMonth()`, qui part sur le réseau (GoTrue `GET /user`), à **chaque** matérialisation — y compris pour un utilisateur sans aucun objectif actif, soit la majorité, alors que `generate-budgets` en enchaîne jusqu'à 36. | Appliqué : early-return sur `goals.length === 0`, la lecture payDay n'a lieu que s'il y a quelque chose à borner (suggestion de `claude[bot]` sur la PR, retenue après un premier passage en `Promise.all` que ce garde rend inutile). Pas de mémoïsation — le repository est un singleton, un cache y ferait fuiter les objectifs d'un user vers un autre. |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (9/9)                                                                                                                                                                                                                                               |
| Files checked | `create-savings-goal.use-case.ts(+spec)`, `template-line-propagation.port.ts`, `template-line-propagation.adapter.ts`, `bulk-template-line-operations.use-case.ts(+spec)`, `supabase-budget.repository.ts(+spec)`, `20260724120000_skip_savings_goal_lines_past_target.sql`, `savings-goal-propagation.integration.spec.ts`, `database.types.ts`, `docs/SAVINGS.md` |
| Unchecked     | none                                                                                                                                                                                                                                                     |
| Unplanned     | `DROP FUNCTION` + re-`GRANT` au lieu du `CREATE OR REPLACE` prévu (Postgres ne peut pas ajouter un paramètre sans créer une surcharge ambiguë) ; `budget-repository.port.ts` non modifié, l'exclusion étant calculée dans le repository (diff plus petit, mêmes trois appelants couverts) ; 5ᵉ copie de la lecture `user_metadata.payDayOfMonth`, conforme au patron déjà suivi 4× dans le même module |
