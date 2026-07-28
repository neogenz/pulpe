# Review: Intervalle optionnel des objectifs d’épargne

- **Verdict**: changes-requested
- **Diff**: `origin/preview...0dcf7a5172da3def5dde7e21bb6571dbc6d61686`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 14 warning, 1 minor

## Phases

### Phase 1 — Poser le contrat nullable et les calculs d’intervalle

- [x] La migration conserve chaque objectif existant, autorise les trois champs absents et les types générés reflètent exactement leur nullabilité. Preuve : `20260726120000_savings_goal_optional_interval.sql:1`, `database.types.ts`.
- [x] Un rekey conserve `target_amount = NULL`; un retrait de cible vide aussi toutes les métadonnées FX. Preuve : `encryption.integration.spec.ts:283`, `savings-goal.repository.spec.ts`.
- [x] Une création `{ name }` est valide ; toutes les combinaisons début/cible/échéance sont acceptées ; début après échéance est refusé. Preuve : `savings-goal-schema.spec.ts:145`.
- [x] Un patch omis préserve, un patch nul retire et un patch valorisé remplace chacun des trois champs. Preuve : `savings-goal-schema.spec.ts:181`, tests repository/update.
- [x] `plannedProjection` inclut le montant de départ sans modifier `plannedCumulative`. Preuve : `savings-goal-progress.spec.ts:718`.
- [x] Sans cible, aucune valeur cible fictive n’est émise ; sans échéance, aucune métrique d’échéance fictive n’est émise. Preuve : `savings-goal-progress.spec.ts:743`.
- [x] Une cible sans échéance expose une estimation seulement si le rythme confirmé la rend calculable. Preuve : `savings-goal-progress.spec.ts:768`.
- [x] L’historique d’un objectif sans début reste stable depuis `createdAt`; aucun mois avant un début explicite ne contribue ni ne reçoit une redistribution. Preuve : `savings-goal-plan.spec.ts:555`.
- [x] La fenêtre restante et les nouvelles écritures commencent à `max(cycle courant, ancrage historique)` sans déplacer les cumuls historiques. Preuve : `savings-goal-plan.spec.ts:584`.
- [x] Une timeline ouverte s’arrête au dernier mois lié ou au cycle courant ; une timeline datée reste plafonnée à 120 périodes. Preuve : `savings-goal-plan.spec.ts:539`.
- [x] Create, update, progress et apply-plan restent type-checkables et valident le contrat nullable avant la matérialisation complète de phase 3. Preuve : `pnpm quality`, 11/11 tâches.
- [x] Repository, mapper, Swagger et documentation décrivent le même contrat ; les suites ciblées passent. Preuve : `savings-goal.mapper.spec.ts:108`, `docs/SAVINGS.md`.

### Phase 2 — Borner la propagation depuis le Mois Type (PUL-312)

- [ ] Le test échoue avant correction parce qu’au moins une création dépasse l’échéance de son objectif. **not-applicable** : étape TDD historique non démontrable dans l’état final ; le test de régression existe et passe.
- [x] Les cas non lié, détaché, `PAUSED`, échéance nulle et propagation désactivée sont présents avant l’implémentation. Preuve : `bulk-template-line-operations.use-case.spec.ts:273`.
- [x] N objectifs provoquent une seule lecture groupée ; aucune lecture n’a lieu sans propagation. Preuve : `bulk-template-line-operations.use-case.spec.ts:342`.
- [x] `PAUSED` reste borné, une échéance nulle reste non bornée et aucun cache inter-requête n’est introduit. Preuve : `bulk-template-line-operations.use-case.spec.ts:431`.
- [x] Chaque élément JSONB porte uniquement ses propres `excluded_budget_ids`; le schéma strict refuse une forme inconnue. Preuve : `rpc-payload.schemas.spec.ts:203`.
- [x] Une ligne non liée ou détachée continue à se propager sans borne. Preuve : `savings-goal-propagation.integration.spec.ts:771`.
- [x] Une création existe jusqu’au mois d’échéance inclus et n’existe pas après. Preuve : `savings-goal-propagation.integration.spec.ts:723`.
- [x] Une mise à jour continue à modifier une occurrence déjà présente après échéance. Preuve : `supabase-budget.repository.spec.ts:578`.
- [x] La signature des RPC reste inchangée et l’intégration `savings-goal-propagation` passe. Preuve : `20260726121000_bound_template_goal_propagation.sql:7`.

### Phase 3 — Implémenter les parcours backend de l’objectif libre

- [x] L’adaptateur restauré délègue au bulk existant ; aucun second chemin de chiffrement, propagation ou recalcul n’est créé. Preuve : `template-line-propagation.adapter.spec.ts:17`.
- [x] `{ name }` crée un objectif et aucune prévision. Preuve : `savings-goal.integration.spec.ts:243`.
- [x] Une mensualité datée produit des `one_off` uniquement dans l’intervalle ; une mensualité ouverte produit une récurrence liée. Preuve : `savings-goal.integration.spec.ts:262`.
- [x] Aucune suggestion automatique n’est calculée si cible ou échéance manque. Preuve : `create-savings-goal.use-case.spec.ts:234`.
- [x] Les réponses sans cible/date contiennent exactement les `null` contractuels et une timeline exploitable. Preuve : `get-savings-goal-progress.use-case.spec.ts:205`.
- [ ] Aucun apply-plan n’écrit avant `startDate`; un pot n’effectue aucun fan-out de mois manquants. **fix** : avant le jour de paie, une mensualité ouverte omet le budget actif payDay-aware (`bulk-template-line-operations.use-case.ts:168`).
- [x] Les ajustements sans cible restent possibles, la redistribution reste indisponible. Preuve : `apply-savings-goal-plan.use-case.spec.ts:142`.
- [x] Ajouter ou retirer cible/date ne touche aucune prévision existante ; le cas distinct d’une échéance avancée reste couvert par les phases PUL-313. Preuve : `savings-goal-plan.spec.ts:619`.
- [x] Les tests unitaires et les intégrations savings-goal ciblées passent. Preuve : suite backend ciblée, 88/88.

### Phase 4 — Adapter le parcours Angular aux quatre combinaisons

- [x] Un nom suffit ; chaque champ optionnel peut être ajouté, modifié puis retiré. Preuve : `savings-goal-form-dialog.schema.spec.ts:30`.
- [x] Début après échéance bloque l’enregistrement ; une mensualité manuelle reste disponible sans échéance. Preuve : `savings-goal-form-dialog.schema.spec.ts:121`.
- [x] Chaque combinaison cible/échéance rend uniquement les métriques applicables. Preuve : `savings-goal-detail-page.spec.ts:314`.
- [x] Sans cible, `plannedProjection` est visible et aucune cible à zéro n’est inventée. Preuve : `savings-goal-detail-page.spec.ts`.
- [x] Le graphe contient la série Cible avec une cible et l’omet sans cible. Preuve : `goal-projection-chart.config.spec.ts:99`.
- [x] Un pot autorise les ajustements mensuels mais ni redistribution ni verdict cible. Preuve : `goal-plan-simulator-store.spec.ts:133`.
- [x] Le parcours E2E nom-seul et le scénario daté historique passent. Preuve : `savings-goals-progress.spec.ts:273`, Playwright 34/34.
- [x] Les tests ciblés et le type-check Angular passent. Preuve : Angular ciblé 65/65 ; `pnpm quality` 11/11.

### Phase 5 — Adapter le parcours iOS et sécuriser le rollout

- [x] iOS décode une liste mêlant objectifs historiques et nom-seul, avec champs valorisés, nuls ou absents. Preuve : `SavingsGoalCodableTests.swift:72`.
- [x] Chaque update encode distinctement omission, `null` et valeur. Preuve : `SavingsGoalCodableTests.swift:177`.
- [x] Une cible de 1’400 CHF de juin à décembre suggère 200 CHF ; aucun mois avant le début n’est contributif. Preuve : `SavingsPlanSuggestedContributionTests.swift:123`.
- [x] Sans cible, le cumul simulé existe mais le verdict, l’écart et la redistribution sont absents. Preuve : `SavingsPlanCalculatorTests.swift:162`.
- [x] Les quatre combinaisons cible/échéance sont utilisables sans crash et sans valeur fictive. Preuve : tests unitaires ciblés 38/38 et UI 7/7.
- [x] Le formulaire nom-seul est valide ; début après échéance est bloqué ; retirer un champ encode `null`. Preuve : `SavingsGoalFormSheetTests.swift:149`.
- [x] Tests ciblés et build `PulpeLocal` passent. Preuve : résultat ciblé iOS 38/38 ; build PulpeLocal publiée dans la PR.
- [ ] La release iOS tolérante précède l’activation des écritures nullable en production. **not-applicable** : ordre de déploiement externe à la branche ; aucune activation production n’est incluse.

### Phase 6 — Rendre l’avancement d’échéance atomique côté serveur (PUL-313)

- [x] La preview retourne uniquement les lignes strictement après la date proposée, selon le cycle payDay-aware. Preuve : `get-savings-goal-future-lines.use-case.spec.ts:93`.
- [x] La preview est pure et applique les mêmes gardes que la future mutation. Preuve : `get-savings-goal-future-lines.use-case.ts`, tests repository.
- [x] Une échéance avancée avec candidates et sans décision répond en conflit sans écriture. Preuve : `update-savings-goal.use-case.spec.ts:207`.
- [x] Recul, retrait, ajout depuis `null`, égalité ou zéro candidate ne demandent aucune réconciliation. Preuve : `update-savings-goal.use-case.spec.ts:130`.
- [ ] Freeze/remove et patch objectif sont validés et écrits dans une seule transaction. **fix** : la RPC verrouille les lignes existantes, mais pas les écrivains concurrents ; une ligne hors horizon peut être insérée après la réconciliation (`20260726122000_reconcile_savings_goal_target_date.sql:175`).
- [ ] Les IDs confirmés doivent être exactement l’ensemble encore éligible ; tout drift annule l’ensemble. **fix** : `budgetLineIds.max(120)` empêche de confirmer un ensemble exact contenant plus de 120 lignes (`shared/schemas.ts:269`).
- [x] Les budgets touchés sont invalidés puis recalculés après commit. Preuve : `supabase-savings-goal.repository.spec.ts`.
- [x] Les tests prouvent zéro écriture sur décision manquante, conflit, drift ou payload invalide. Preuve : `update-savings-goal.use-case.spec.ts:152`, intégration `:403`.
- [x] Les types générés et toutes les suites backend ciblées passent. Preuve : `database.types.ts`, suite backend ciblée 88/88.

### Phase 7 — Ajouter la confirmation d’échéance sur Angular et iOS

- [x] Une date avancée déclenche preview avant mutation ; toute autre transition de date suit le PATCH ordinaire. Preuve : `savings-goal-detail-page.spec.ts:557`, `SavingsGoalStoreTests.swift:108`.
- [x] Zéro candidate n’ouvre aucun dialogue. Preuve : `savings-goal-detail-page.spec.ts:598`.
- [x] Web et iOS réutilisent le composant d’arrêt existant avec un contexte et des libellés adaptés. Preuve : `goal-generation-stop-dialog.ts`, `GoalGenerationStopSheet.swift`.
- [x] Freeze et remove sont clairement distingués ; remove est annoncé comme destructif. Preuve : specs Angular/iOS et traductions françaises.
- [x] Annuler produit zéro écriture ; confirmer produit exactement un PATCH atomique. Preuve : `savings-goal-detail-page.spec.ts:627`, `SavingsGoalStoreTests.swift:275`.
- [x] Le POST generation-stop reste réservé au changement de statut. Preuve : clients API Angular/iOS.
- [x] Un conflit recharge l’état sans faux succès ni patch partiel. Preuve : `savings-goal-detail-page.spec.ts:667`.
- [ ] Les scénarios d’orchestration Angular et iOS passent, y compris les modifications simultanées d’autres champs. **fix** : échéance avancée + statut `PAUSED`/`COMPLETED` ignore la confirmation generation-stop après le PATCH atomique (`savings-goal-detail-page.ts:850`).

### Phase 8 — Afficher l’objectif lié dans le Mois Type (PUL-317)

- [x] Toutes les lignes sont résolues depuis une seule liste ; aucune requête par ligne ou par ID n’existe. Preuve : `template-details-store.spec.ts:184`.
- [x] Une navigation froide produit au plus un GET, une liste déjà cachée n’en produit aucun. Preuve : `template-details-store.spec.ts:185`.
- [x] Une ligne liée du Mois Type web affiche le nom courant de l’objectif ; une ligne libre ne change pas. Preuve : `template-line-card.spec.ts`, E2E.
- [x] Un renommage met à jour l’affordance via le cache réactif. Preuve : `template-details-store.spec.ts`.
- [x] Le mode Tableau Angular affiche l’objectif dans la cellule nom sans nouvelle colonne. Preuve : `name-cell.spec.ts`.
- [x] Les modes mobile/enveloppes web et le détail budget iOS restent inchangés. Preuve : tests Angular ciblés et UI long-press existante.
- [x] Le Mois Type iOS réutilise le chip épargne existant et reflète un renommage. Preuve : `TemplateDetailsGoalLinkTests.swift:21`.
- [x] Tests Angular/iOS ciblés et build `PulpeLocal` passent. Preuve : Angular 65/65, iOS 38/38, build publiée.

### Phase V1 — Réparer les preuves web et les mocks contractuels

- [x] Cible-seule n’expose ni projection d’échéance ni verdict de rythme ; les états sans cible n’exposent ni cible fictive ni suggestion booléenne fictive. Preuve : `savings-goals-progress.spec.ts:135`.
- [x] Chaque combinaison affiche uniquement les métriques, trajectoires et actions autorisées par le contrat shared. Preuve : `savings-goals-progress.spec.ts:442`.
- [x] Nom-seul, cible-seule, échéance-seule et cible+échéance sont créés, ouverts, modifiés puis supprimés depuis l’UI. Preuve : `savings-goals-progress.spec.ts:305`.
- [x] Un champ intact est omis, un champ retiré vaut `null`, un champ ajouté porte sa valeur ; début après échéance n’émet aucune écriture. Preuve : `savings-goals-progress.spec.ts:467`.
- [x] Une échéance avancée avec candidats affiche la preview avant toute mutation ; zéro candidat, échéance repoussée/retirée ou ajout depuis `null` n’affiche pas le dialogue. Preuve : `savings-goals-progress.spec.ts:583`.
- [x] Annuler produit zéro écriture ; `freeze` et `remove` produisent chacun un PATCH atomique complet et zéro POST séparé. Preuve : `savings-goals-progress.spec.ts:705`.
- [x] Un conflit recharge la preview, laisse objectif et prévisions inchangés et n’affiche aucun faux succès. Preuve : `savings-goals-progress.spec.ts:745`.
- [x] Chaque surface produit au plus un GET liste et échoue sur tout GET d’objectif par ID ; le nom lié reste affiché et la ligne libre inchangée. Preuve : `template-details-view.spec.ts:168`, `budget-table-mobile-menu.spec.ts:239`.
- [x] Les trois specs ciblées passent avec `--retries=0`; aucun premier échec n’est masqué. Preuve : Playwright 34/34 ; `.last-run.json` = `passed`.

### Phase V2 — Ajouter la preuve UI iOS déterministe et réparer la preview

- [x] Le détail accepte un service mémoire mais conserve `SavingsGoalService.shared` par défaut ; la preview `TemplateDetailsView` s’ouvre avec ses deux stores requis. Preuve : `SavingsGoalDetailView.swift`, `TemplateDetailsView.swift`.
- [x] Chaque scénario ouvre une vraie vue de production avec des données déterministes, sans réseau, authentification ni base locale. Preuve : `SavingsGoalIntervalUITestHarness.swift`.
- [x] Sans scénario, l’application suit son lancement normal ; les scénarios long-press existants restent routés. Preuve : `PulpeApp.swift`, `BudgetLongPressUITestHarness.swift`.
- [x] Le formulaire nom-seul se sauvegarde ; un début après échéance ne transmet aucune sauvegarde. Preuve : `SavingsGoalIntervalUITests.swift:20`.
- [ ] Les quatre combinaisons cible/échéance rendent uniquement leurs régions applicables sans crash ni contenu fictif. **fix** : les quatre scénarios n’assertent que cible, marqueur d’échéance et rythme ; projection, montant requis, estimation, suggestion, trajectoire et actions conditionnelles restent non prouvés (`SavingsGoalIntervalUITests.swift:48`).
- [x] Annuler la confirmation ne transmet aucun update ; `freeze` et `remove` transmettent chacun un unique update avec la décision choisie. Preuve : `SavingsGoalIntervalUITests.swift:92`.
- [x] Une ligne liée affiche le chip et le nom de l’objectif ; une ligne libre n’affiche aucun emplacement vide. Preuve : `SavingsGoalIntervalUITests.swift:121`.
- [ ] Les UI tests ciblés, le test de lancement, les tests long-press et la build `PulpeLocal` réussissent sur le même simulateur. **fix** : la preuve finale publiée couvre 7 tests feature, pas `testAppLaunches`, les long-press et la build PulpeLocal sur ce même simulateur (`phase-2.md:85`).

### Phase V3 — Inspecter le rendu cross-platform et publier les preuves

- [x] À 390×844, le label vide « Montant de départ (optionnel) » et le suffixe monétaire occupent des rectangles distincts. Preuve : `savings-goal-initial-amount.spec.ts:15`.
- [x] Le correctif repose sur le comportement natif de `mat-form-field`, sans CSS local ni modification des autres champs. Preuve : `savings-goal-form-dialog.ts`, `savings-goal-initial-amount.spec.ts:40`.
- [x] Les surfaces web retenues sont visibles et utilisables à 1440×900 et 390×844, sans coupe, chevauchement, scroll bloqué ni contenu conditionnel fantôme. Preuve : inspection web publiée pour les deux viewports.
- [x] Le formulaire, les détails, la confirmation et les lignes liées respectent la hiérarchie et les règles sémantiques Pulpe ; le mode Tableau reste lisible en desktop. Preuve : captures web inspectées et E2E ciblé.
- [ ] Les mêmes surfaces sont validées dans un iPhone Simulator en thème clair, et les cas ciblés restent utilisables en Dynamic Type d’accessibilité et thème sombre. **fix** : le harness ne varie ni catégorie Dynamic Type ni apparence sombre (`SavingsGoalIntervalUITests.swift:163`).
- [x] Aucun contrôle essentiel ni montant n’est tronqué ; la sheet de confirmation et le chip lié conservent leur hiérarchie. Preuve : 10 captures dans `/tmp/pulpe-merge-ui-20260727-8.xcresult`.
- [ ] Les quatre documents du plan sont suivis par Git et la PR contient le SHA, les résultats des tests et un jeu de captures rattaché à chaque surface et environnement. **fix** : le commentaire PR contient SHA et résultats, mais aucun jeu de captures web/iOS attaché (`phase-3.md:124`).
- [ ] Tout échec donne un verdict `not ready` et maintient la PR en draft ; aucun succès n’est déduit d’une build seule ou d’une capture non inspectée. **fix** : la PR est marquée prête malgré les critères de preuve ouverts et les findings actifs (`phase-3.md:127`).

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| 🟡 warning | functional | P3 | `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.ts:168` | La création d’une récurrence ouverte sélectionne les budgets futurs depuis le mois civil UTC. Avant le jour de paie, le budget actif appartient au cycle précédent et ne reçoit pas la contribution liée. | Transmettre `payDayOfMonth` et utiliser `getBudgetPeriodForDate(now, payDay)` comme borne basse. |
| 🟡 warning | functional | P6 | `backend-nest/supabase/migrations/20260726122000_reconcile_savings_goal_target_date.sql:175` | La réconciliation verrouille seulement les lignes candidates existantes. Un écrivain concurrent sans verrou partagé peut insérer une ligne hors horizon après le commit. | Prendre un verrou par objectif dans tous les écrivains de lignes liées, puis revalider l’horizon sous verrou. |
| 🟡 warning | functional | P6 | `shared/schemas.ts:269` | `budgetLineIds.max(120)` confond nombre de périodes et nombre de lignes. Plusieurs lignes par mois peuvent rendre impossible la confirmation de l’ensemble exact. | Retirer cette borne ou définir une limite distincte fondée sur le nombre maximal réel de lignes. |
| 🟡 warning | functional | P7 | `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:850` | Une échéance avancée combinée à `PAUSED`/`COMPLETED` retourne après le PATCH atomique et saute la confirmation generation-stop. | Faire retourner le succès de l’avancement, puis traiter la transition de statut après ce PATCH seulement. |
| 🟡 warning | functional | V2 | `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:48` | Les quatre états de détail ne vérifient pas toutes les régions conditionnelles demandées. | Étendre les attentes aux projection, requis, estimation, suggestion, trajectoire et actions. |
| 🟡 warning | functional | V2 | `aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/phase-2.md:85` | La preuve post-merge n’établit pas lancement, long-press et build PulpeLocal sur le même simulateur. | Exécuter et publier la suite exacte sur un simulateur unique. |
| 🟡 warning | functional | V3 | `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:163` | Aucun lancement ne valide Dynamic Type d’accessibilité ou le thème sombre. | Ajouter les variantes ciblées de lancement et leurs captures. |
| 🟡 warning | functional | V3 | `aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/phase-3.md:124` | La PR publie SHA et résultats, mais pas les captures rattachées aux surfaces et environnements. | Attacher les captures nommées avec viewport/simulateur, OS, thème et taille de texte. |
| 🟡 warning | functional | V3 | `aidd_docs/tasks/2026_07/2026_07_27_savings_goal_cross_platform_validation/phase-3.md:127` | La PR est prête alors que les preuves V2/V3 et des critères fonctionnels restent ouverts. | Maintenir la PR en draft jusqu’à fermeture des critères, puis actualiser la preuve. |
| 🟡 warning | code | P1 | `shared/src/calculators/savings-goal-plan.ts:151` | Avec un début futur et un montant initial, la timeline part à zéro puis ajoute artificiellement le stock au mois futur ; sans ligne future, elle ne l’ajoute jamais. | Initialiser le cumul affiché avec le montant initial et éviter son second ajout à l’ancrage futur. |
| 🟡 warning | conform | P6 | `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:524` | `supabaseError` est placé dans `loggingContext` tout en étant déjà la cause, contre la règle backend de sérialisation des erreurs. | Retirer l’erreur du contexte et conserver uniquement `cause`. |
| 🟡 warning | code | P8 | `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:34` | Le GET auxiliaire des objectifs est attendu avant le chargement principal du Mois Type ; sa latence bloque inutilement le premier rendu. | Charger les deux ressources en parallèle ou isoler le chargement auxiliaire. |
| 🟡 warning | rot | P5 | `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:119` | La carte de progression privée duplique `GoalProgressCard`, désormais sans callsite, et les deux variantes divergent déjà. | Réutiliser `GoalProgressCard` puis supprimer la copie privée. |
| 🟡 warning | conform | V2 | `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift:96`, `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:114`, `ios/Pulpe/Features/SavingsGoals/Components/GoalProgressCard.swift:90` | `swiftlint lint --no-cache --strict` échoue sur trois violations : corps de fonction 52>50 et lignes 127/121. | Extraire la validation d’ajustement et envelopper les deux lignes ; la consolidation de la carte peut supprimer une violation. |
| 🟢 minor | code | P4 | `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.spec.ts:58` | Le test modifie un signal privé et lit un computed privé ; il resterait vert si le binding visible cassait. | Piloter les contrôles/DOM et vérifier la contribution mensuelle rendue. |

## Verification

| Metric | Value |
| --- | --- |
| Verdict | `changes-requested` |
| Verified | 88.5% — 85/96 critères cochés |
| Unchecked | 11 — P2.1 `not-applicable`; P3.6 `fix`; P5.8 `not-applicable`; P6.5 `fix`; P6.6 `fix`; P7.8 `fix`; V2.5 `fix`; V2.8 `fix`; V3.5 `fix`; V3.7 `fix`; V3.8 `fix` |
| Findings | 0 critical, 14 warning, 1 minor |
| Files checked | 144 fichiers du diff inventoriés ; deux plans, 11 phases, contrats shared, migrations/RPC, backend, Angular/E2E, SwiftUI/XCUITest et preuves PR inspectés statiquement |
| Existing execution evidence | `pnpm quality` 11/11 ; shared 574/574 ; Angular 65/65 ; Playwright 34/34 avec `--retries=0` ; iOS ciblé 38/38 ; UI iOS 7/7 et 10 captures |
| Review execution | Revue statique en lecture seule ; aucune suite relancée pendant cette passe |
| Unplanned | `ios/project.yml:232` ajoute la génération d’Info.plist révélée nécessaire par la cible UI ; changement requis mais absent de la projection initiale |
