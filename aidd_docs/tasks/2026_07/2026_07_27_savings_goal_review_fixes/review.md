# Review: Corrections de l’intervalle d’épargne

- **Verdict**: changes-requested
- **Diff**: `73ebb0d4d...734e08243`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 3 warning, 1 minor

## Phases

### Phase 1 — Sécuriser les invariants shared et backend

- [x] Le cycle actif avant le jour de paie est propagé — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:344`.
- [x] Les bornes après jour de paie et sans préférence restent couvertes — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:314`.
- [x] Les opérations ordinaires et lignes non liées gardent leur contrat — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:373`.
- [x] Un snapshot exact de 121 IDs est accepté — `shared/src/savings-goal-schema.spec.ts:223`.
- [ ] L’échéance et le nouveau lien hors horizon sont sérialisés — **fix** : quand la preview ne trouve aucune candidate, le use case utilise le PATCH ordinaire sans le verrou de la RPC (`update-savings-goal.use-case.ts:111`).
- [x] Les écritures dans l’horizon, hors horizon et historiques sont distinguées — `backend-nest/src/modules/savings-goal/savings-goal-generation-stop.integration.spec.ts:492`.
- [x] Les contrôles propriétaire et kind restent centralisés — `backend-nest/supabase/migrations/20260727120000_enforce_savings_goal_link_horizon.sql:20`.
- [x] `initialAmount` initialise le premier cumul confirmé — `shared/src/calculators/savings-goal-plan.ts:151`.
- [x] Les autres cumuls et contributions restent invariants — `shared/src/calculators/savings-goal-plan.spec.ts:181`.
- [x] L’erreur Supabase n’est plus exposée dans `loggingContext` — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts:1148`.
- [x] Shared, backend, intégration Supabase réelle et génération de types disposent d’une preuve verte sur `aab32f22d` — 576 tests shared, 63 tests backend et 15 tests d’intégration.

### Phase 2 — Corriger l’orchestration Angular

- [x] Annuler la décision d’échéance n’écrit rien — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:589`.
- [x] Une erreur interrompt le flux avant toute seconde décision — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:702`.
- [x] Échéance puis statut sont traités séquentiellement — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:851`.
- [x] Refuser la seconde décision conserve le premier PATCH — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:662`.
- [x] La seconde décision utilise uniquement sa propre preview — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:615`.
- [x] Une preview vide n’ouvre pas de second dialogue — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:683`.
- [x] Le calcul visible est vérifié par le DOM public — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.spec.ts:25`.
- [x] L’E2E impose l’ordre strict des requêtes — `frontend/e2e/tests/features/savings-goals-progress.spec.ts:757`.
- [x] Type-check, 43 tests Angular ciblés et 15 scénarios Playwright disposent d’une preuve verte sans retry sur `aab32f22d`.

### Phase 3 — Consolider et prouver les surfaces iOS

- [x] Le détail du Mois Type charge indépendamment du store auxiliaire — `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:33`.
- [x] La ligne libre reste utilisable et le lien s’enrichit après chargement — `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:36`.
- [x] Le détail utilise une seule `GoalProgressCard` — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:119`.
- [x] La cible et la projection conditionnelles sont rendues par la carte unique — `ios/Pulpe/Features/SavingsGoals/Components/GoalProgressCard.swift:50`.
- [x] SwiftLint strict et `pnpm quality` disposent d’une preuve verte sur `aab32f22d`.
- [x] Les quatre contrats cible/échéance vérifient présence et absence — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:18`.
- [x] Formulaire et détail passent en Dynamic Type accessibilité — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:131`.
- [x] La confirmation sombre garde ses montants et trois décisions — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:158`.
- [x] Les captures sont conservées dans le `.xcresult` — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:278`.
- [x] Les 8 tests de l’intervalle disposent d’une preuve verte sans réseau ni authentification sur `aab32f22d`.

### Phase 4 — Produire la preuve de merge cross-platform

- [x] Toutes les suites disposent d’une preuve verte sur l’arbre exécutable `aab32f22d` — shared 576, backend 63, Supabase réel 15, Angular 43, Playwright 15, Swift 83, UI iOS 11 et build réussie.
- [x] Aucun résultat ne dépend d’un retry — Playwright exécuté avec `--retries=0`; XCTest final sans échec.
- [x] Le web est utilisable à 1440×900 et 390×844 — captures `/tmp/pulpe-web-savings-goal-desktop.png` et `/tmp/pulpe-web-savings-goal-mobile.png`.
- [x] iOS est utilisable en clair, Dynamic Type accessibilité et sombre — 12 captures extraites de `Test-PulpeUITests-2026.07.27_17-55-41-+0200.xcresult`.
- [ ] Publier des captures identifiées dans la PR — **not-applicable** : publication externe non autorisée.
- [ ] Fermer les findings dans la PR — **not-applicable** : action externe non autorisée et findings locaux encore ouverts.
- [ ] Joindre résultats et captures à la PR — **not-applicable** : commentaire ou upload externe non autorisé.
- [ ] Modifier le statut draft/ready de la PR — **not-applicable** : changement de statut externe non autorisé.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| 🟡 warning | functional | P1 | `backend-nest/src/modules/savings-goal/application/update-savings-goal.use-case.ts:111` | Une échéance avancée sans candidate observée contourne `reconcileTargetDate`. L’intégration concurrente appelle la RPC directement avec une liste vide (`savings-goal-generation-stop.integration.spec.ts:439`) et ne couvre donc pas ce chemin réel. Un insert concurrent peut lire l’ancienne échéance sous `FOR KEY SHARE` pendant que le PATCH non-clé valide la nouvelle date, puis laisser une ligne liée hors horizon. | Faire passer tout avancement d’échéance par une écriture sérialisée, y compris avec un snapshot vide, puis tester l’entrelacement via le use case plutôt que par appel direct de la RPC. |
| 🟡 warning | code | P1 | `backend-nest/supabase/migrations/20260726121000_bound_template_goal_propagation.sql:207` | Le use case calcule `excluded_budget_ids` pour les lignes mises à jour, mais la boucle SQL UPDATE ignore ce champ. Relier une ligne Mois Type existante à un objectif daté tente donc de poser le lien sur tous les budgets matérialisés ; le trigger ajouté ensuite rejette toute la RPC dès qu’un budget dépasse l’échéance. | Pour un update, préserver `savings_goal_id` dans les budgets exclus tout en propageant les autres champs, puis couvrir l’ajout d’un lien à une ligne existante avec un budget après échéance. |
| 🟡 warning | code | P1 | `shared/schemas.ts:279` | La borne dite « 120 périodes » compare des mois civils et ignore `payDayOfMonth`. Avant le jour de paie, la date maximale acceptée par le shared, Angular et iOS peut appartenir à la 121e période payDay-aware ; la timeline est alors tronquée avant l’échéance et une création peut matérialiser 121 cycles. | Valider la période cible contre la période courante avec le jour de paie dans les use cases, puis dériver les maxima Angular et iOS avec le même calcul de période. |
| 🟢 minor | code | P1 | `shared/schemas.ts:336` | Le schéma UPDATE accepte toute échéance ISO non nulle dans l’horizon, y compris une nouvelle date passée. L’omission suffit déjà à préserver une échéance historique ; accepter une nouvelle valeur passée contredit la règle du plan et laisse l’API contourner les minima web/iOS. | Dans le use case, refuser une date passée seulement lorsqu’elle diffère de l’échéance courante ; garder l’omission et la valeur historique identique valides. |

## Verification

| Metric | Value |
| --- | --- |
| Verdict | `changes-requested` |
| Verified | 86.8% — 33/38 critères cochés |
| Unchecked | 5 — P1.5 `fix`; P4.5–P4.8 `not-applicable` sans action externe autorisée |
| Findings | 0 critical, 3 warning, 1 minor |
| Files checked | 151 fichiers du diff `73ebb0d4d...734e08243` inventoriés ; plans, contrats shared, migrations/RPC, backend, Angular/E2E, SwiftUI/XCUITest et preuves cross-platform inspectés statiquement |
| Existing execution evidence | Sur `aab32f22d` : `pnpm quality` 11/11 ; shared 576 ; backend 63 ; Supabase réel 15 ; Angular 43 ; Playwright 15 avec `--retries=0` ; Swift 83 ; UI iOS 11 ; build réussie |
| Review execution | Revue statique uniquement ; aucune suite, build, navigateur ou simulateur relancé pendant cette passe |
| Unplanned | none |
