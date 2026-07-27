# Review: Suppression d’un objectif avec aperçu d’impact

- **Verdict**: changes-requested
- **Diff**: `73ebb0d4db704fe8bedc9d0c1e8abbccd88e31ed...0e36f8af9`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 4 warning, 0 minor

## Phases

### Plan initial — Phase 1 — Définir le contrat partagé

- [x] Un aperçu avec Mois Type, 76 budgets, prévisions et transactions reste valide sans limite de tableau et expose les totaux attendus — `shared/src/savings-goal-schema.spec.ts:300`
- [x] Les commandes invalides, doublons de révision et modes inconnus sont rejetés par le contrat partagé — `shared/src/savings-goal-schema.spec.ts:269`, `shared/src/savings-goal-schema.spec.ts:282`
- [x] Les types et codes uniques sont exportés pour le web et NestJS, avec un contrat Codable équivalent côté iOS — `shared/index.ts:96`, `shared/src/error-codes.ts:140`, `ios/Pulpe/Domain/Models/SavingsGoalDeletion.swift:3`

### Plan initial — Phase 2 — Garantir l’aperçu et la mutation en base

- [x] L’aperçu collecte les prévisions du modèle, budgets et transactions, puis le repository déchiffre les montants et calcule leurs totaux — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:853`
- [x] Les trois modes appliquent leurs effets exacts dans une transaction PostgreSQL atomique — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:349`
- [x] Une révision obsolète échoue avant toute mutation et conserve toutes les entités — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:412`
- [x] Le repository ne renvoie que des montants déchiffrés et déduplique les budgets touchés — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:317`, `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:856`
- [x] L’isolation inter-utilisateurs et le parcours complet sur 76 budgets sont couverts — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:453`, `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:480`

### Plan initial — Phase 3 — Orchestrer l’API de suppression

- [x] La route d’aperçu vérifie la propriété et renvoie le contrat partagé — `backend-nest/src/modules/savings-goal/application/get-savings-goal-deletion-impact.use-case.ts:19`, `backend-nest/src/modules/savings-goal/infrastructure/http/savings-goal.controller.ts:228`
- [x] L’ancien DELETE conserve sa sémantique de déliaison et le nouveau POST applique la commande explicite — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.ts:29`
- [x] Les caches sont invalidés après commit et seuls les budgets retournés par la RPC sont recalculés — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.ts:82`
- [x] Le conflit ne lance aucun travail post-commit et toute défaillance post-commit porte le code partiel dédié — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:98`, `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:140`
- [x] La documentation décrit les trois effets, la garde de révision et le recalcul non rollbackable — `docs/SAVINGS.md:266`

### Plan initial — Phase 4 — Construire l’expérience web

- [x] Le dialogue charge un aperçu frais avant d’autoriser une commande qui reprend exactement sa révision — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:164`
- [x] Un conflit garde l’objectif visible et une erreur de recalcul retire l’état local déjà supprimé — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:298`, `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:356`
- [x] Le choix initial est `goal_only` et conserve prévisions et transactions — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:67`
- [x] Les 76 budgets, leurs prévisions et leurs transactions sont rendus dans une région bornée et scrollable — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:211`
- [x] Résumé, totaux et actions restent hors de la zone scrollable, avec une région accessible au clavier et au lecteur d’écran — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:36`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:114`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:199`
- [x] Le CTA reflète le mode exact et la page ne navigue qu’après un commit confirmé ou partiel — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:84`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:798`
- [x] Les états du dialogue et les deux erreurs dédiées ont des textes français déterministes — `frontend/projects/webapp/public/i18n/fr.json:921`, `frontend/projects/webapp/src/app/core/api/api-error-localizer.ts:71`

### Plan initial — Phase 5 — Construire l’expérience iOS

- [x] Le service décode l’impact complet et envoie le mode avec la révision affichée — `ios/Pulpe/Domain/Models/SavingsGoalDeletion.swift:3`, `ios/Pulpe/Domain/Services/SavingsGoalService.swift:72`
- [x] Un conflit conserve l’objectif et une erreur partielle retire l’objectif tout en invalidant budgets et Mois Type — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:172`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:194`
- [x] La feuille choisit `goal_only` par défaut, conserve les 76 budgets et fixe résumé et action autour d’un `LazyVStack` scrollable — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:182`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:214`, `ios/Pulpe/Features/SavingsGoals/Components/GoalDeletionSheet.swift:128`
- [x] La suppression des transactions reste dépendante de la suppression des prévisions et de leur présence — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:192`
- [x] Les montants, groupes et boutons utilisent les styles Dynamic Type et des libellés VoiceOver explicites — `ios/Pulpe/Features/SavingsGoals/Components/GoalDeletionSheet.swift:87`, `ios/Pulpe/Features/SavingsGoals/Components/GoalDeletionSheet.swift:230`
- [x] Les tests couvrent les trois payloads, conflit, erreur partielle et conservation des 76 budgets — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:151`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:214`

### Remédiation — Phase 1 — Backend : classifier toute défaillance post-commit

- [x] Après un commit DB réussi, un rejet du cache retourne le code partiel dédié avec la cause et tous les IDs de budgets touchés — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:140`
- [x] Aucun recalcul n’est lancé tant que l’invalidation du cache n’a pas réussi — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:163`
- [x] Une erreur repository ou un conflit de révision ne déclenche ni invalidation ni recalcul et conserve son code actuel — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:70`, `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:98`
- [x] Un échec de recalcul conserve le même code, `partialFailure: true` et le même avertissement client qu’avant — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:114`
- [x] Le chemin nominal invalide une fois puis recalcule uniquement les budgets retournés ; le DELETE legacy ne supprime toujours aucune prévision — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:61`, `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:80`

### Remédiation — Phase 2 — iOS : réconcilier la suppression et rafraîchir le Mois Type

- [x] Une erreur réseau transitoire suivie d’un 404 typé produit deux appels identiques et jamais un message serveur générique — `ios/PulpeTests/Domain/Services/SavingsGoalDeletionRequestTests.swift:9`
- [x] Le store traite le 404 terminal comme un succès convergent et ne propose aucun retry destructif — `ios/Pulpe/Domain/Store/SavingsGoalStore.swift:128`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:216`
- [x] Le conflit conserve toujours l’objectif ; l’échec de recalcul le retire et conserve son avertissement français — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:172`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:194`
- [x] Toute suppression commise change la version Mois Type exactement une fois et un détail de modèle déjà créé recharge ses lignes — `ios/Pulpe/Domain/Store/SavingsGoalStore.swift:146`, `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:33`
- [x] Les échecs pré-commit ne modifient ni la version Mois Type ni les caches budget — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:234`
- [x] Les tests couvrent succès, replay 404, conflit, erreur partielle et reset avec les mêmes effets locaux que le commit backend — `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:151`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:337`

### Remédiation — Phase 3 — Web : extraire la vue sans changer son rendu

- [x] Le dialogue compile avec un template HTML et un style SCSS externes, sans nouveau composant ni nouvelle dépendance — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:39`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:18`
- [x] `goal-deletion-dialog.ts` contient 134 lignes et exclusivement la logique du composant — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:1`
- [x] Les trois modes renvoient les mêmes commandes et la révision affichée avant l’extraction — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:164`
- [x] Les 76 budgets restent tous rendus dans la même région scrollable accessible, avec résumé et actions hors défilement — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:211`
- [x] Aucun texte, ordre visuel, attribut d’accessibilité ou sélecteur de test n’est modifié — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:1`

### Remédiation — Phase 4 — Validation croisée et nouvelle revue

- [x] Les reproductions ciblées backend, iOS et web protègent chaque correctif — `backend-nest/src/modules/savings-goal/application/remove-savings-goal.use-case.spec.ts:140`, `ios/PulpeTests/Domain/Store/SavingsGoalStoreTests.swift:216`, `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:325`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:112`
- [x] L’aperçu exhaustif, les trois modes, le conflit, l’erreur partielle et le cas 76 budgets restent couverts sur backend, web et iOS — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:349`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:164`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:214`
- [x] `pnpm quality` et `git diff --check` passent sur le même HEAD — validation d’implémentation `0e36f8af9`, Turbo 11/11, diff sans sortie
- [ ] La nouvelle revue valide 100 % des critères avec verdict `approve`, sans warning ni critical — trois warnings de conformité restent ouverts
- [x] Aucun changement hors projection et aucune action Git distante ne sont inclus — 68 fichiers du diff vérifiés, branche locale non poussée

### Finalisation — Phase 1 — Web : converger quand l’objectif est déjà absent

- [x] Un objectif présent localement puis absent au POST produit une promesse résolue, disparaît du store et n’est plus sélectionné — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:325`
- [x] Le replay 404 invalide exactement une fois les caches objectifs, budgets et Mois Type — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:348`
- [x] La page emprunte son chemin de succès existant et revient à la liste sans afficher une erreur 404 — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.ts:334`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:809`
- [x] Le conflit conserve toujours l’objectif ; l’erreur post-commit le retire toujours puis reste propagée pour afficher l’avertissement — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:298`, `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:356`
- [x] Toute autre erreur pré-commit conserve l’objectif et n’invalide aucun cache — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.ts:341`, `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:298`

### Finalisation — Phase 2 — Web : exécuter le dialogue avec le runner Vitest réel

- [x] La reproduction pré-correctif échoue en demandant `resolveComponentResources()` — reproduction enregistrée avant `0cc900195`
- [x] Les tests DOM utilisent le contenu des fichiers HTML et SCSS externalisés, sans duplication du template dans la spec — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:18`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:114`
- [x] Les trois modes, la révision, le retry, l’accessibilité et les 76 budgets conservent leurs assertions — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.spec.ts:164`
- [x] La spec puis toute la suite frontend passent via `vitest run` — validation d’implémentation : 197 fichiers, 2 379 tests
- [x] Le build Angular compile le dialogue avec ses fichiers externes de production — validation d’implémentation du target `webapp:build`

### Finalisation — Phase 3 — Validation complète du correctif

- [x] Les reproductions 404 et ressources externes passent avec le runner frontend réel — validation finale : 3 fichiers, 49 tests
- [x] La suite frontend complète, `pnpm quality` et `git diff --check` passent sur le même HEAD — `0e36f8af9`, 2 379 tests, Turbo 11/11, diff sans sortie
- [x] Le HEAD local reste basé sur le dernier `origin/preview` récupéré avant l’implémentation — `origin/preview...HEAD` = `0 15`
- [x] Aucun workflow, secret, métadonnée de PR ou fichier produit hors des trois fichiers projetés n’est modifié par le correctif — `d3eb7e82b...0e36f8af9`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | Remédiation — Phase 4 | `aidd_docs/tasks/2026_07/2026_07_27_suppression-objectif-impact-review-fixes/phase-4.md:57` | Le critère exige une revue finale à 100 % avec verdict `approve`, mais les trois écarts de conformité ci-dessous restent ouverts. | Corriger les trois warnings de conformité, puis relancer les trois axes de revue. |
| 🟡 warning | conform | Plan initial — Phase 4 | `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:5` | Le nom d’objectif interpolé est un texte saisi par l’utilisateur, mais son conteneur n’a pas `ph-no-capture`, contrairement à la règle `posthog-privacy.md`; il peut apparaître dans les replays PostHog. | Ajouter `ph-no-capture` au paragraphe d’introduction ou au seul fragment affichant `data.goalName`. |
| 🟡 warning | conform | Plan initial — Phase 4 | `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-dialog.service.ts:79` | `openDeletion` n’a qu’un consommateur, aucune variante mobile et n’enveloppe plus un dialogue générique ; `feature-dialog-services.md` exige alors une ouverture directe depuis le composant. | Injecter `MatDialog` dans la page détail, y ouvrir `GoalDeletionDialog`, puis retirer cette méthode et ses imports du service. |
| 🟡 warning | conform | Plan initial — Phase 3 | `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:560` | Les nouveaux contextes `BusinessException` de suppression omettent `userId` et certains recopient l’erreur dans `supabaseError` tout en la passant déjà comme `cause`, contrairement à `error-handling-backend.md`; le mapping applicatif à `remove-savings-goal.use-case.ts:68` omet aussi `userId`. | Ajouter le `userId` du provider ou du cas d’usage à chaque contexte, retirer `supabaseError` du contexte et conserver uniquement la chaîne `cause`. |

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 98.4% (60/61) |
| Files checked | 68 fichiers dans `73ebb0d4db704fe8bedc9d0c1e8abbccd88e31ed...0e36f8af9`, plans initial, remédiation et finalisation inclus |
| Unchecked | Remédiation Phase 4 : revue finale à 100 % avec verdict `approve` — fix |
| Unplanned | none |
