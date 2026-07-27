# Review: Intervalle optionnel des objectifs d’épargne

- **Verdict**: changes-requested
- **Diff**: `origin/preview...58e0256811975a7a788c4f1905d3acb483f9f487`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 10 warning, 1 minor

## Phases

### Phase 1 — Poser le contrat nullable et les calculs d’intervalle

- [x] La migration conserve chaque objectif existant, autorise les trois champs absents et les types générés reflètent exactement leur nullabilité. — `backend-nest/supabase/migrations/20260726120000_savings_goal_optional_interval.sql:1`
- [x] Un rekey conserve `target_amount = NULL`; un retrait de cible vide aussi toutes les métadonnées FX. — `backend-nest/src/modules/encryption/encryption.integration.spec.ts:283`
- [x] Une création `{ name }` est valide ; toutes les combinaisons début/cible/échéance sont acceptées ; début après échéance est refusé. — `shared/src/savings-goal-schema.spec.ts:145`
- [x] Un patch omis préserve, un patch nul retire et un patch valorisé remplace chacun des trois champs. — `shared/src/savings-goal-schema.spec.ts:181`
- [x] `plannedProjection` inclut le montant de départ sans modifier `plannedCumulative`. — `shared/src/calculators/savings-goal-progress.spec.ts:718`
- [x] Sans cible, aucune valeur cible fictive n’est émise ; sans échéance, aucune métrique d’échéance fictive n’est émise. — `shared/src/calculators/savings-goal-progress.spec.ts:718`
- [x] Une cible sans échéance expose une estimation seulement si le rythme confirmé la rend calculable. — `shared/src/calculators/savings-goal-progress.spec.ts:743`
- [x] L’historique d’un objectif sans début reste stable depuis `createdAt`; aucun mois avant un début explicite ne contribue ni ne reçoit une redistribution. — `shared/src/calculators/savings-goal-plan.spec.ts:555`
- [x] La fenêtre restante et les nouvelles écritures commencent à `max(cycle courant, ancrage historique)` sans déplacer les cumuls historiques. — `shared/src/calculators/savings-goal-plan.spec.ts:584`
- [x] Une timeline ouverte s’arrête au dernier mois lié ou au cycle courant ; une timeline datée reste plafonnée à 120 périodes. — `shared/src/calculators/savings-goal-plan.spec.ts:539`
- [x] Create, update, progress et apply-plan restent type-checkables et valident le contrat nullable avant la matérialisation complète de phase 3. — `pnpm quality` 11/11
- [x] Repository, mapper, Swagger et documentation décrivent le même contrat ; les suites ciblées passent. — `backend-nest/src/modules/savings-goal/infrastructure/mappers/savings-goal.mapper.spec.ts:108`

### Phase 2 — Borner la propagation depuis le Mois Type

- [ ] Le test échoue avant correction parce qu’au moins une création dépasse l’échéance de son objectif. — not-applicable: l’échec historique n’est pas observable dans l’état final
- [x] Les cas non lié, détaché, `PAUSED`, échéance nulle et propagation désactivée sont présents avant l’implémentation. — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:273`
- [x] N objectifs provoquent une seule lecture groupée ; aucune lecture n’a lieu sans propagation. — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:342`
- [x] `PAUSED` reste borné, une échéance nulle reste non bornée et aucun cache inter-requête n’est introduit. — `backend-nest/src/modules/budget/infrastructure/persistence/supabase-budget.repository.spec.ts:578`
- [x] Chaque élément JSONB porte uniquement ses propres `excluded_budget_ids`; le schéma strict refuse une forme inconnue. — `backend-nest/src/modules/budget-template/infrastructure/persistence/schemas/rpc-payload.schemas.spec.ts:203`
- [x] Une ligne non liée ou détachée continue à se propager sans borne. — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:431`
- [x] Une création existe jusqu’au mois d’échéance inclus et n’existe pas après. — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:771`
- [x] Une mise à jour continue à modifier une occurrence déjà présente après échéance. — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:723`
- [x] La signature des RPC reste inchangée et l’intégration `savings-goal-propagation` passe. — `backend-nest/supabase/migrations/20260726121000_bound_template_goal_propagation.sql:7`

### Phase 3 — Matérialiser les quatre formes d’objectif

- [x] L’adaptateur restauré délègue au bulk existant ; aucun second chemin de chiffrement, propagation ou recalcul n’est créé. — `backend-nest/src/modules/budget-template/infrastructure/adapters/template-line-propagation.adapter.spec.ts:17`
- [x] `{ name }` crée un objectif et aucune prévision. — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:243`
- [x] Une mensualité datée produit des `one_off` uniquement dans l’intervalle ; une mensualité ouverte produit une récurrence liée. — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:262`
- [x] Aucune suggestion automatique n’est calculée si cible ou échéance manque. — `backend-nest/src/modules/savings-goal/application/create-savings-goal.use-case.spec.ts:234`
- [x] Les réponses sans cible/date contiennent exactement les `null` contractuels et une timeline exploitable. — `backend-nest/src/modules/savings-goal/application/get-savings-goal-progress.use-case.spec.ts:205`
- [x] Aucun apply-plan n’écrit avant `startDate`; un pot n’effectue aucun fan-out de mois manquants. — `backend-nest/src/modules/savings-goal/application/apply-savings-goal-plan.use-case.spec.ts:142`
- [x] Les ajustements sans cible restent possibles, la redistribution reste indisponible. — `shared/src/calculators/savings-goal-plan.spec.ts:619`
- [x] Ajouter ou retirer cible/date ne touche aucune prévision existante ; le cas distinct d’une échéance avancée reste couvert par les phases PUL-313. — `backend-nest/src/modules/savings-goal/savings-goal-progress.integration.spec.ts:338`
- [x] Les tests unitaires et les intégrations savings-goal ciblées passent. — backend ciblé 88/88

### Phase 4 — Adapter le parcours Angular

- [x] Un nom suffit ; chaque champ optionnel peut être ajouté, modifié puis retiré. — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.schema.spec.ts:30`
- [x] Début après échéance bloque l’enregistrement ; une mensualité manuelle reste disponible sans échéance. — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.schema.spec.ts:121`
- [x] Chaque combinaison cible/échéance rend uniquement les métriques applicables. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:314`
- [x] Sans cible, `plannedProjection` est visible et aucune cible à zéro n’est inventée. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:314`
- [x] Le graphe contient la série Cible avec une cible et l’omet sans cible. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.spec.ts:99`
- [x] Un pot autorise les ajustements mensuels mais ni redistribution ni verdict cible. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/services/goal-plan-simulator-store.spec.ts:133`
- [x] Le parcours E2E nom-seul et le scénario daté historique passent. — `frontend/e2e/tests/features/savings-goals-progress.spec.ts:82`
- [x] Les tests ciblés et le type-check Angular passent. — Angular 197/197 fichiers, 2403/2403 tests

### Phase 5 — Adapter le parcours iOS et sécuriser le rollout

- [x] iOS décode une liste mêlant objectifs historiques et nom-seul, avec champs valorisés, nuls ou absents. — `ios/PulpeTests/Domain/Models/SavingsGoalCodableTests.swift:72`
- [x] Chaque update encode distinctement omission, `null` et valeur. — `ios/PulpeTests/Domain/Models/SavingsGoalCodableTests.swift:177`
- [x] Une cible de 1’400 CHF de juin à décembre suggère 200 CHF ; aucun mois avant le début n’est contributif. — `ios/PulpeTests/Domain/Formulas/SavingsPlanSuggestedContributionTests.swift:123`
- [x] Sans cible, le cumul simulé existe mais le verdict, l’écart et la redistribution sont absents. — `ios/PulpeTests/Domain/Formulas/SavingsPlanCalculatorTests.swift:162`
- [x] Les quatre combinaisons cible/échéance sont utilisables sans crash et sans valeur fictive. — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:161`
- [x] Le formulaire nom-seul est valide ; début après échéance est bloqué ; retirer un champ encode `null`. — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:149`
- [x] Tests ciblés et build `PulpeLocal` passent. — `SavingsGoalFormSheetTests` 16/16, `TEST SUCCEEDED`
- [ ] La release iOS tolérante précède l’activation des écritures nullable en production. — not-applicable: ordre de rollout production non observable dans le dépôt

### Phase 6 — Réconcilier atomiquement une échéance avancée

- [x] La preview retourne uniquement les lignes strictement après la date proposée, selon le cycle payDay-aware. — `backend-nest/src/modules/savings-goal/application/get-savings-goal-future-lines.use-case.spec.ts:93`
- [x] La preview est pure et applique les mêmes gardes que la future mutation. — `backend-nest/src/modules/savings-goal/application/update-savings-goal.use-case.spec.ts:207`
- [x] Une échéance avancée avec candidates et sans décision répond en conflit sans écriture. — `backend-nest/src/modules/savings-goal/application/update-savings-goal.use-case.spec.ts:130`
- [x] Recul, retrait, ajout depuis `null`, égalité ou zéro candidate ne demandent aucune réconciliation. — `backend-nest/src/modules/savings-goal/application/update-savings-goal.use-case.spec.ts:207`
- [x] Freeze/remove et patch objectif sont validés et écrits dans une seule transaction. — `backend-nest/supabase/migrations/20260726122000_reconcile_savings_goal_target_date.sql:181`
- [x] Les IDs confirmés doivent être exactement l’ensemble encore éligible ; tout drift annule l’ensemble. — `backend-nest/src/modules/savings-goal/savings-goal-generation-stop.integration.spec.ts:403`
- [x] Les budgets touchés sont invalidés puis recalculés après commit. — `backend-nest/src/modules/savings-goal/application/update-savings-goal.use-case.spec.ts:152`
- [x] Les tests prouvent zéro écriture sur décision manquante, conflit, drift ou payload invalide. — `backend-nest/src/modules/savings-goal/savings-goal-generation-stop.integration.spec.ts:403`
- [x] Les types générés et toutes les suites backend ciblées passent. — backend ciblé 88/88, use case 15/15, typecheck vert

### Phase 7 — Confirmer l’avance d’échéance sur Angular et iOS

- [x] Une date avancée déclenche preview avant mutation ; toute autre transition de date suit le PATCH ordinaire. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:557`
- [x] Zéro candidate n’ouvre aucun dialogue. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:627`
- [x] Web et iOS réutilisent le composant d’arrêt existant avec un contexte et des libellés adaptés. — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:274`
- [x] Freeze et remove sont clairement distingués ; remove est annoncé comme destructif. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:598`
- [x] Annuler produit zéro écriture ; confirmer produit exactement un PATCH atomique. — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:108`
- [x] Le POST generation-stop reste réservé au changement de statut. — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:275`
- [x] Un conflit recharge l’état sans faux succès ni patch partiel. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:667`
- [x] Les scénarios d’orchestration Angular et iOS passent, y compris les modifications simultanées d’autres champs. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:744`

### Phase 8 — Afficher les objectifs liés dans les budgets

- [x] Toutes les lignes sont résolues depuis une seule liste ; aucune requête par ligne ou par ID n'existe. — `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-details-store.spec.ts:184`
- [x] Une navigation froide produit au plus un GET, une liste déjà cachée n’en produit aucun. — `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-details-store.spec.ts:185`
- [x] Une ligne liée du Mois Type web affiche le nom courant de l’objectif ; une ligne libre ne change pas. — `frontend/projects/webapp/src/app/feature/budget-templates/details/components/template-line-card.spec.ts:79`
- [x] Un renommage met à jour l’affordance via le cache réactif. — `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-details-store.spec.ts:215`
- [x] Le mode Tableau Angular affiche l’objectif dans la cellule nom sans nouvelle colonne. — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-table/cells/name-cell.spec.ts:53`
- [x] Les modes mobile/enveloppes web et le détail budget iOS restent inchangés. — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.ts:220`
- [x] Le Mois Type iOS réutilise le chip épargne existant et reflète un renommage. — `ios/PulpeTests/Features/Templates/TemplateDetailsGoalLinkTests.swift:21`
- [x] Tests Angular/iOS ciblés et build `PulpeLocal` passent. — Angular 2403/2403, iOS ciblé et build verts

### Phase 9 — Prouver les parcours critiques sur le web

- [ ] Nom-seul, cible-seule, échéance-seule et cible+échéance peuvent être créés, ouverts, modifiés et nettoyés sans valeur fictive. — fix: les scénarios ajoutés s'arrêtent après la création et l'ouverture du détail (`frontend/e2e/tests/features/savings-goals-progress.spec.ts:318`)
- [ ] Un champ inchangé est omis, un champ retiré vaut `null`, un champ ajouté porte sa valeur ; début après échéance n'émet aucune écriture. — fix: seuls les payloads de création omission/valeur sont observés ; aucun PATCH, retrait explicite ou intervalle invalide n'est exercé (`frontend/e2e/tests/features/savings-goals-progress.spec.ts:389`)
- [ ] Chaque détail expose uniquement les métriques et actions définies pour sa combinaison. — fix: les assertions sont partielles et le mock émet des métriques d'échéance impossibles pour la cible-seule (`frontend/e2e/tests/features/savings-goals-progress.spec.ts:106`)
- [ ] Une échéance avancée avec candidats affiche la preview avant toute mutation ; zéro candidat ou date non avancée n'affiche pas le dialogue. — fix: seul le chemin avec candidat est présent (`frontend/e2e/tests/features/savings-goals-progress.spec.ts:426`)
- [ ] Annuler produit zéro écriture ; freeze et remove produisent chacun un PATCH atomique complet et zéro POST séparé. — fix: seul `freeze` est couvert (`frontend/e2e/tests/features/savings-goals-progress.spec.ts:519`)
- [ ] Un conflit laisse l'objectif et les prévisions inchangés et n'affiche aucun faux succès. — fix: aucune réponse conflit n'est mockée (`frontend/e2e/tests/features/savings-goals-progress.spec.ts:488`)
- [x] Le Mois Type et le mode Tableau affichent le nom courant d'un objectif lié ; une ligne libre reste inchangée. — `frontend/e2e/tests/features/template-details-view.spec.ts:168`, `frontend/e2e/tests/features/budget-table-mobile-menu.spec.ts:233`
- [ ] Une liste froide provoque au plus un GET d'objectifs et aucune requête par ligne ou par ID. — fix: le Mois Type compte la liste sans interdire les requêtes par ID ; le mode Tableau interdit les IDs sans compter la liste (`frontend/e2e/tests/features/template-details-view.spec.ts:172`, `frontend/e2e/tests/features/budget-table-mobile-menu.spec.ts:56`)
- [x] Les trois specs ciblées passent sans retry masquant un premier échec. — exécution antérieure ciblée : 23/23, retries 0

### Phase 10 — Prouver les parcours critiques sur iOS

- [ ] Les critères et la preuve UI iOS sont disponibles dans la branche. — fix: `plan.md` référence `phase-2.md`, absent de `HEAD`, et aucun harness/XCUITest d'intervalle n'est ajouté (`aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/plan.md:20`)

### Phase 11 — Valider le rendu cross-platform et publier les preuves

- [ ] Les critères et les preuves visuelles web/iOS sont disponibles dans la branche. — fix: `plan.md` référence `phase-3.md`, absent de `HEAD`; aucune preuve de rendu inspecté n'est rattachée au SHA (`aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/plan.md:21`)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | code | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:125` | `progressFor` retourne `projected=3600` et `paceStatus=on_track` pour une cible sans échéance, alors que le calculateur canonique retourne `null`; il retourne aussi `suggestCompletion=false` sans cible au lieu de `null`. Le test traverse donc des états serveur impossibles. | Produire le mock depuis la matrice contractuelle et vérifier explicitement l'absence de `stat-projected`, du chip de rythme et des actions non applicables. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:318` | Le critère création → ouverture → modification → retrait → nettoyage n'est pas satisfait : aucun scénario matriciel ne passe en édition. | Étendre chaque scénario jusqu'au PATCH, au retrait explicite et au nettoyage. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:389` | La preuve tri-state et la garde `startDate <= targetDate` manquent au niveau UI : aucun `null` de retrait ni absence de requête sur intervalle invalide n'est observé. | Observer les PATCH omission/`null`/valeur et compter zéro écriture sur intervalle invalide. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:106` | La matrice ne prouve pas l'ensemble des métriques, trajectoires et actions conditionnelles, et son mock contredit le contrat sur le cas cible-seule. | Utiliser des payloads backend possibles et assert chaque région applicable ou absente. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:426` | La réconciliation ne couvre ni zéro candidat ni les transitions de date qui ne doivent pas ouvrir le dialogue. | Ajouter zéro candidat, date reculée, date retirée et date ajoutée depuis `null`. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:519` | Annulation et mode `remove` ne sont pas testés; seule la confirmation `freeze` prouve le PATCH atomique. | Ajouter annulation avec zéro écriture et `remove` avec un PATCH et zéro POST. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/savings-goals-progress.spec.ts:488` | Aucun scénario conflit/drift ne prouve l'absence de mutation partielle et de faux succès. | Mocker le conflit, vérifier l'état inchangé, le rechargement de preview et l'absence de succès. |
| 🟡 warning | functional | 9 | `frontend/e2e/tests/features/template-details-view.spec.ts:172` | La preuve réseau PUL-317 est scindée entre deux specs : le Mois Type ne piège pas les GET par ID et le mode Tableau ne borne pas le nombre de GET liste. | Dans chaque surface, compter la liste et faire échouer toute route par ID. |
| 🟡 warning | functional | 10 | `aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/plan.md:20` | La phase iOS référencée n'est pas versionnée et aucun test UI iOS déterministe ne prouve les parcours demandés. | Versionner la phase, implémenter le harness/XCUITest minimal et conserver la preuve simulateur. |
| 🟡 warning | functional | 11 | `aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/plan.md:21` | La validation visuelle demandée n'existe pas dans la branche : ni phase versionnée, ni captures web/iOS liées au SHA, ni verdict reproductible. | Versionner la phase et publier les captures/conditions d'inspection prévues avant de déclarer la PR prête. |
| 🟢 minor | code | 8 | `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:398` | La vue exige désormais `SavingsGoalStore` dans l'environnement, mais sa preview n'en injecte pas; la preview plante à l'ouverture. | Ajouter `.environment(SavingsGoalStore())` à la preview. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 86.6% (71/82) |
| Files checked | 135 fichiers du diff : deux plans, migrations PUL-312/PUL-313/PUL-314, contrats et calculateurs shared, ports/repositories/use cases backend, parcours et tests Angular/Playwright, modèles/stores/vues/tests iOS; revue statique, aucune commande de test ou build relancée |
| Unchecked | P2.1 échec historique avant correction — not-applicable; P5.8 ordre réel du rollout production — not-applicable; P9.1–P9.6 et P9.8 — fix; P10 phase/preuves iOS absentes — fix; P11 phase/preuves visuelles absentes — fix |
| Unplanned | none |
