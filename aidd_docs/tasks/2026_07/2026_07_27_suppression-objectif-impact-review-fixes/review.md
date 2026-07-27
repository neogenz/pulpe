# Review: Corrections de la suppression d’un objectif avec aperçu d’impact

- **Verdict**: approve
- **Diff**: `4d0d94bc68ce0562ce71c9abca66a041c724f917...e7367cb2083d0124c0283b17617de9ef0fa7f22e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Plan initial — Phase 1 — Définir le contrat partagé

- [x] Un aperçu avec Mois Type, 76 budgets, prévisions et transactions reste valide sans limite de tableau et expose les totaux attendus — `shared/src/savings-goal-schema.spec.ts:300`
- [x] Les commandes invalides, doublons de révision et modes inconnus sont rejetés par le contrat partagé — `shared/src/savings-goal-schema.spec.ts:257`, `shared/src/savings-goal-schema.spec.ts:269`
- [x] Les types et codes uniques sont exportés pour le web et NestJS, avec un contrat Codable équivalent côté iOS — `shared/index.ts:96`, `shared/src/error-codes.ts:140`, `ios/Pulpe/Domain/Models/SavingsGoalDeletion.swift:3`

### Plan initial — Phase 2 — Garantir l’aperçu et la mutation en base

- [x] L’aperçu collecte les prévisions du modèle, budgets et transactions, puis le repository déchiffre les montants et calcule leurs totaux — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts:947`
- [x] Les trois modes appliquent leurs effets exacts dans une transaction PostgreSQL atomique — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:350`
- [x] Une révision obsolète échoue avant toute mutation et conserve toutes les entités — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:412`
- [x] Le repository ne renvoie que des montants déchiffrés et déduplique les budgets touchés — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts:1016`, `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts:1057`
- [x] L’isolation inter-utilisateurs et le parcours complet sur 76 budgets sont couverts — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:453`, `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:480`

### Plan initial — Phase 3 — Orchestrer l’API de suppression

- [x] La route d’aperçu vérifie la propriété et renvoie le contrat partagé — `backend-nest/src/modules/savings-goal/application/get-savings-goal-deletion-impact.use-case.spec.ts:65`
- [x] L’ancien DELETE conserve sa sémantique de déliaison et le nouveau POST applique la commande explicite — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.ts:29`
- [x] Les caches sont invalidés après commit et seuls les budgets retournés par la RPC sont recalculés — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.ts:82`
- [x] Le conflit ne lance aucun travail post-commit et toute défaillance post-commit porte le code partiel dédié — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:98`, `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:140`
- [x] La documentation décrit les trois effets, la garde de révision et le recalcul non rollbackable — `docs/SAVINGS.md:267`

### Plan initial — Phase 4 — Construire l’expérience web

- [x] Le dialogue charge un aperçu frais avant d’autoriser une commande qui reprend exactement sa révision — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:99`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:126`
- [x] Un conflit garde l’objectif visible et une erreur de recalcul retire l’état local déjà supprimé — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:94`
- [x] Le choix initial est `goal_only` et conserve prévisions et transactions — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:67`
- [x] Les 76 budgets, leurs prévisions et leurs transactions sont rendus dans une région bornée et scrollable — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:197`
- [x] Résumé, totaux et actions restent hors de la zone scrollable, avec une région accessible au clavier et au lecteur d’écran — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:38`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:121`
- [x] Le CTA reflète le mode exact et la page ne navigue qu’après un commit confirmé ou partiel — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:84`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:612`
- [x] Les états du dialogue et les deux erreurs dédiées ont des textes français déterministes — `frontend/projects/webapp/public/i18n/fr.json:921`, `frontend/projects/webapp/src/app/core/api/api-error-localizer.spec.ts:146`

### Plan initial — Phase 5 — Construire l’expérience iOS

- [x] Le service décode l’impact complet et envoie le mode avec la révision affichée — `ios/PulpeTests/Domain/Models/SavingsGoalCodableTests.swift:190`, `ios/PulpeTests/Domain/Services/SavingsGoalDeletionRequestTests.swift:9`
- [x] Un conflit conserve l’objectif et une erreur partielle retire l’objectif tout en invalidant budgets et Mois Type — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:172`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:194`
- [x] La feuille choisit `goal_only` par défaut, conserve les 76 budgets et fixe résumé et action autour d’un `LazyVStack` scrollable — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:182`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:214`
- [x] La suppression des transactions reste dépendante de la suppression des prévisions et de leur présence — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:192`
- [x] Les montants, groupes et boutons utilisent les styles Dynamic Type et des libellés VoiceOver explicites — `ios/Pulpe/Features/SavingsGoals/Components/GoalDeletionSheet.swift:87`, `ios/Pulpe/Features/SavingsGoals/Components/GoalDeletionSheet.swift:230`
- [x] Les tests couvrent les trois payloads, conflit, erreur partielle, replay 404 et conservation des 76 budgets — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:154`, `ios/PulpeTests/Domain/Services/SavingsGoalDeletionRequestTests.swift:9`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:214`

### Remédiation — Phase 1 — Backend : classifier toute défaillance post-commit

- [x] Après un commit DB réussi, un rejet du cache retourne le code partiel dédié avec la cause et tous les IDs de budgets touchés — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:140`
- [x] Aucun recalcul n’est lancé tant que l’invalidation du cache n’a pas réussi — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:164`
- [x] Une erreur repository ou un conflit de révision ne déclenche ni invalidation ni recalcul et conserve son code actuel — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:70`, `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:98`
- [x] Un échec de recalcul conserve le même code, `partialFailure: true` et le même avertissement client — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:114`
- [x] Le chemin nominal invalide une fois puis recalcule uniquement les budgets retournés ; le DELETE legacy ne supprime toujours aucune prévision — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:49`, `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:80`

### Remédiation — Phase 2 — iOS : réconcilier la suppression et rafraîchir le Mois Type

- [x] Une erreur réseau transitoire suivie d’un 404 typé produit deux appels identiques et jamais un message serveur générique — `ios/PulpeTests/Domain/Services/SavingsGoalDeletionRequestTests.swift:9`
- [x] Le store traite le 404 terminal comme un succès convergent et ne propose aucun retry destructif — `ios/Pulpe/Domain/Store/SavingsGoalStore.swift:128`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:216`
- [x] Le conflit conserve toujours l’objectif ; l’échec de recalcul le retire et conserve son avertissement français — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:172`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:194`
- [x] Toute suppression commise change la version Mois Type exactement une fois et un détail de modèle déjà créé recharge ses lignes — `ios/Pulpe/Domain/Store/SavingsGoalStore.swift:146`, `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:33`
- [x] Les échecs pré-commit ne modifient ni la version Mois Type ni les caches budget — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:234`
- [x] Les tests couvrent succès, replay 404, conflit, erreur partielle et reset avec les mêmes effets locaux que le commit backend — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:154`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:337`

### Remédiation — Phase 3 — Web : extraire la vue sans changer son rendu

- [x] Le dialogue compile avec un template HTML et un style SCSS externes, sans nouveau composant ni nouvelle dépendance — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:51`
- [x] `goal-deletion-dialog.ts` contient 134 lignes et exclusivement la logique du composant — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:1`
- [x] Les trois modes renvoient les mêmes commandes et la révision affichée avant l’extraction — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:150`
- [x] Les 76 budgets restent tous rendus dans la même région scrollable accessible, avec résumé et actions hors défilement — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:197`
- [x] Aucun texte, ordre visuel, attribut d’accessibilité ou sélecteur de test n’est modifié — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:1`, test Angular ciblé : 54/54

### Remédiation — Phase 4 — Validation croisée et nouvelle revue

- [x] Les quatre reproductions ciblées passent et chacune protège son correctif — backend 7/7, iOS transport/store 16/16, Angular dialogue 5/5
- [x] L’aperçu exhaustif, les trois modes, le conflit, l’erreur partielle et le cas 76 budgets restent verts sur backend, web et iOS — partagé 555/555, backend ciblé 47/47, intégration 9/9, web 54/54, iOS 44/44
- [x] `pnpm quality` et `git diff --check` passent sur le même HEAD — Turbo 11/11, `git diff --check` sans sortie
- [x] La nouvelle revue valide les 47 critères combinés avec verdict `approve`, sans warning ni critical — `review.md:3`
- [x] Aucun changement hors projection et aucune action Git distante ne sont inclus — 62 fichiers du diff initial plus remédiation vérifiés ; aucun push ni PR

## Findings

None.

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 100% (47/47) |
| Files checked | All 62 changed files in `4d0d94bc68ce0562ce71c9abca66a041c724f917...e7367cb2083d0124c0283b17617de9ef0fa7f22e` |
| Unchecked | none |
| Unplanned | none |
