# Review: PUL-6 — Planifier une période de budgets

- **Verdict**: blocked
- **Diff**: `main...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_03
- **Findings**: 1 critical, 2 warnings, 3 minors

## Phases

### Phase 1 — Verrouiller le contrat de période partagé

- [x] Le schéma conserve les appels valides et refuse une longueur hors `1...36` ou une dernière période hors borne — `shared/schemas.ts:212`, `shared/src/budget-generate-schema.spec.ts:8`
- [x] TypeScript et Swift partagent les mêmes conversions d'index et le même compte inclusif, dont décembre → janvier — `shared/src/calculators/budget-period.spec.ts:460`, `ios/PulpeTests/Domain/Formulas/BudgetPeriodCalculatorTests.swift:334`
- [x] Le workflow décrit le défaut payDay-aware, la plage inclusive, les skips et les deux compteurs — `docs/BUSINESS_WORKFLOW.md:140`

### Phase 2 — Rendre la génération backend atomique

- [x] Le RPC valide avant écriture, verrouille par utilisateur, ignore les périodes existantes dans l'ordre et délègue la série dans une transaction avec les grants attendus — `backend-nest/supabase/migrations/20260901120000_generate_budgets_atomically.sql:27`, `backend-nest/supabase/tests/generate_budgets_atomically.sql:66`
- [x] Le contrat HTTP reste compatible, les exclusions d'objectifs sont calculées par période, les recalculs passent par le port chiffré et le cache est invalidé — `backend-nest/src/modules/budget/infrastructure/http/budget.controller.ts:183`, `backend-nest/src/modules/budget/infrastructure/persistence/supabase-budget.repository.ts:526`, `backend-nest/src/modules/budget/infrastructure/persistence/supabase-budget.repository.ts:703`
- [x] Les preuves SQL et Bun couvrent rollback SQL, ownership, dérive de réponse et limite au sixième appel — `backend-nest/supabase/tests/generate_budgets_atomically.sql:114`, `backend-nest/src/modules/budget/schemas/rpc-responses.schema.spec.ts:7`, `backend-nest/src/modules/budget/budget.rate-limit.spec.ts:22`

### Phase 3 — Ajouter la planification à la liste Web

- [x] Le formulaire part du cycle courant, couvre 12 périodes et repasse le DTO transformé dans le schéma partagé avant envoi — `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.schema.ts:23`, `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:237`
- [x] Le dialogue réutilise `TemplatesList` et `TemplateStore`, expose des contrôles Material accessibles et conserve l'état en cas d'erreur — `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:83`, `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:296`
- [x] Le succès invalide la clé budget et affiche séparément les créations/skips dans les quatre catalogues — `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/services/template-store.ts:174`, `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts:267`, `frontend/projects/webapp/public/i18n/fr.json:523`

### Phase 4 — Ajouter la planification à la liste iOS

- [x] iOS encode le body exact sur `POST /budgets/generate`, avec les headers existants, et décode budgets/skips — `ios/Pulpe/Core/Network/Endpoints.swift:120`, `ios/PulpeTests/Domain/Services/BudgetGenerationRequestTests.swift:7`
- [x] La sheet réutilise le picker et les cartes de Mois Type, suit les tokens et bloque les plages inversées ou supérieures à 36 — `ios/Pulpe/Features/Budgets/BudgetList/PlanBudgetsView.swift:22`, `ios/Pulpe/Features/Budgets/BudgetList/PlanBudgetsView.swift:206`
- [x] Les actions VoiceOver sont distinctes; le succès ferme, rafraîchit et annonce les deux compteurs localisés — `ios/Pulpe/Features/Budgets/BudgetList/BudgetListView.swift:66`, `ios/Pulpe/Features/Budgets/BudgetList/PlanBudgetsView.swift:258`, `ios/Pulpe/Resources/Localizable.xcstrings:1567`

### Phase 5 — Ajouter la planification à la liste Android

- [x] Android utilise les schémas partagés et invalide tout le préfixe budget après succès — `android/src/features/budgets/budget-api.ts:22`, `android/src/features/budgets/generate-budgets-mutation.ts:6`
- [x] Le formulaire propose 12 cycles payDay-aware, des sélecteurs mois/année explicites et bloque les plages inversées ou supérieures à 36 — `android/src/app/(main)/budget/plan.tsx:48`, `android/src/app/(main)/budget/plan.tsx:62`
- [x] L'action reste disponible à vide, se distingue du FAB et restitue les deux compteurs localisés dans `Notice` après invalidation — `android/src/app/(main)/(tabs)/budgets.tsx:198`, `android/src/app/(main)/(tabs)/budgets.tsx:291`, `android/src/app/(main)/(tabs)/budgets.tsx:298`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 critical | code | 2 | `backend-nest/src/modules/budget/application/generate-budgets.use-case.ts:70` | Après un échec de recalcul, l'invalidation du cache est attendue avant `rollbackCreatedBudgets`. Si `cache.del` rejette, le rollback n'est jamais appelé et le lot nouvellement créé reste en base avec un recalcul partiel, contrairement à la compensation annoncée. | Exécuter le rollback avant toute invalidation faillible, empêcher une erreur de cache de masquer l'erreur initiale, puis ajouter un test où recalcul et invalidation échouent et où la suppression du lot reste appelée. |
| 🟡 warning | code | 3 | `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:230` | `rangeErrorKey` ne couvre que l'ordre et les 36 mois, alors que `canSubmit` applique aussi les bornes du schéma partagé. Les datepickers n'ont ni `min` ni `max`: une année hors contrat désactive donc « Planifier » sans erreur visible ou annoncée. | Borner les datepickers ou convertir tout échec du schéma partagé en erreur localisée reliée aux contrôles. |
| 🟡 warning | code | 3–5 | `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:171`; `ios/Pulpe/Features/Budgets/BudgetList/PlanBudgetsView.swift:47`; `android/src/app/(main)/budget/plan.tsx:102` | Les sorties restent actives pendant la mutation non annulable: Annuler/backdrop sur Web, fermeture/swipe sur iOS et retour sur Android peuvent faire croire à une annulation alors que l'écriture continue; le callback local de résultat peut alors être perdu. | Désactiver fermeture, retour et dismiss interactif tant que la génération est en cours, avec un test par plateforme sur la sortie pendant `pending`. |
| 🟢 minor | rot | 3 | `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:43` | `monthYearFormats` recopie exactement `buildMonthYearFormats` déjà présent dans `create-budget/budget-creation-dialog.ts:47`. | Partager l'unique helper de formats mois/année entre les deux dialogues. |
| 🟢 minor | rot | 2 | `backend-nest/supabase/tests/README.md:34` | L'inventaire documenté annonce encore 15 fonctions et 9 RPC invoker, alors que l'ajout porte les tableaux de preuve à 16 fonctions et 10 invoker. | Mettre les deux compteurs à jour. |
| 🟢 minor | conform | 1 | `docs/BUSINESS_WORKFLOW.md:13` | Le diff contient 39 ajouts/23 suppressions dans ce document, dont une normalisation Markdown hors du scénario PUL-6; cela élargit le diff au-delà de la règle de discipline de scope. | Conserver uniquement les lignes métier PUL-6 autour du scénario de planification et restaurer le formatage sans rapport. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (15/15) |
| Files checked | 61/61 fichiers du diff: `aidd_docs/tasks/2026_09/2026_09_01_pul-6-planifier-budgets/{plan,phase-1..5}.md`, `shared/{schemas.ts,src/**}`, `backend-nest/{src/modules/budget/**,src/types/database.types.ts,supabase/**}`, `frontend/projects/webapp/{public/i18n/*.json,src/app/feature/budget/budget-list/**}`, `ios/{Pulpe/**,PulpeTests/**}`, `android/src/**`, `docs/BUSINESS_WORKFLOW.md` |
| Unchecked | none |
| Unplanned | `docs/BUSINESS_WORKFLOW.md:13` — normalisation Markdown hors du scénario PUL-6 |
| Runtime | Not run — revue statique conformément au skill |
