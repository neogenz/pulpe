# Review: Remédiation finale de PUL-18

- **Verdict**: approve
- **Diff**: `origin/preview...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_15
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Fermer le contrat historique et l'accessibilité

- [x] La fenêtre 24 mois finissant en janvier 2020 est rejetée avant le repository — `shared/schemas.ts:353`, `shared/src/tag-schema.spec.ts:58`
- [x] La fenêtre minimale valide commence en janvier 2020 et les quatre horizons restent acceptés — `shared/src/tag-schema.spec.ts:47`, `shared/src/tag-schema.spec.ts:66`
- [x] La pastille tags est focusable, expose tous les noms et reste absente sans tag — `frontend/projects/webapp/src/app/ui/tag-indicator/tag-indicator.ts:24`, `frontend/projects/webapp/src/app/ui/tag-indicator/tag-indicator.spec.ts:24`
- [x] Le commentaire partagé décrit les junctions actuelles sans annoncer un travail futur — `shared/schemas.ts:311`

### Phase 2 — Rendre les mises à jour unitaires atomiques

- [x] Pour les trois entités, les erreurs scalaires et tags annulent les deux familles d'écritures — `backend-nest/src/modules/tag/atomic-tagged-entity-updates.integration.spec.ts:257`
- [x] Les patches tags seuls, scalaires seuls et mixtes conservent les shapes et `tagIds` — `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.spec.ts:337`, `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line.repository.spec.ts:612`, `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.spec.ts:273`
- [x] Les parents et tags étrangers restent invisibles et non modifiables entre tenants — `backend-nest/src/modules/tag/atomic-tagged-entity-updates.integration.spec.ts:299`
- [x] Les contrats 404, 409, 500 et objectif d'épargne sont préservés — `backend-nest/src/common/utils/tag-links.util.ts:128`, `backend-nest/src/common/utils/tag-links.util.spec.ts:93`
- [x] Les repositories chiffrent les montants avant les RPCs et le round-trip reste déchiffré — `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.ts:261`, `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line.repository.ts:491`, `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts:369`
- [x] La migration expose trois RPCs typés, invoker et restreints sans cast de signature — `backend-nest/supabase/migrations/20260715140000_atomic_tagged_entity_updates.sql:5`, `backend-nest/src/types/database.types.ts:756`

### Phase 3 — Rendre le bulk template atomique

- [x] Un échec tags annule créations, modifications, suppressions et propagations — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:191`
- [x] Après rollback, tags et `savings_goal_id` restent ceux d'avant sur template et budgets — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:342`
- [x] Le nominal propage ensemble montants chiffrés, FX, objectif et tags vers les lignes éligibles — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:388`
- [x] Les budgets, objectifs et tags étrangers échouent sans mutation ni fuite inter-tenant — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:424`, `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:518`
- [x] Le repository émet un seul appel mutant bulk et ne compense plus les tags — `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts:703`, `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.spec.ts:729`
- [x] Erreurs métier, budgets affectés et refetch gardent leur contrat — `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts:715`, `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.spec.ts:676`

### Phase 4 — Valider et remettre la PR à niveau

- [x] Quality, unitaires, intégrations, migrations et E2E historique passent sur le même code produit — GitHub Actions `29411240370`, local `frontend/e2e/tests/features/tags-history.spec.ts` sur le port 4217
- [x] Les suites objectifs d'épargne et lissage restent vertes avec les transactions tags — `backend-nest/src/modules/budget-template/savings-goal-propagation.integration.spec.ts:191`, `backend-nest/src/modules/budget-line/budget-line-spread.integration.spec.ts:1`
- [x] La revue code, fonctionnelle et pertinence couvre 100% des critères sans warning ni critical — `aidd_docs/tasks/2026_07/2026_07_15_pul18-review-remediation/review.md`
- [x] La branche distante et la PR #502 ciblent `preview` avec le titre et le périmètre livrés — PR #502, HEAD `maximedesogus/pul-18-pouvoir-ajouter-des-tags-par-depense`
- [x] Les checks GitHub du code produit sont verts et GitHub déclare la PR `MERGEABLE` / `CLEAN` — GitHub Actions `29411240370`, Claude Code Review `29411240059`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (21/21) |
| Files checked | Diff complet `origin/preview...HEAD`; plan et 4 phases; schemas partagés; migrations atomiques; repositories transaction, budget-line et template; intégrations PUL-12/PUL-17/PUL-18; UI picker et indicateur; tests unitaires, intégration et E2E associés |
| Unchecked | none |
| Unplanned | `tag-picker.ts`: signal interne passé en champ privé ES; `tag-indicator.ts`: commentaire redondant supprimé après revue externe |
