# Review: PUL-18 — tags par dépense et historique multi-mois

- **Verdict**: changes-requested
- **Diff**: `e9794ab7fcb3537523319bed30889b175758b4fb...a0dc143df33e9bc603079bf0c17bdf92cac7f21f`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_15
- **Findings**: 0 critical, 5 warning, 1 minor

## Phases

### Phase 1 — Isolation de session et validation aux frontières

- [x] Le logout vide le cache tags et la session suivante recharge une liste propre — `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts:50`, `frontend/projects/webapp/src/app/core/tag/tag-store.spec.ts:93`
- [x] Une exception du cleanup tags est journalisée sans interrompre les autres nettoyages — `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.spec.ts:146`
- [x] `PGRST116` retourne 404, le doublon 409 et une erreur Supabase réelle 500 — `backend-nest/src/modules/tag/infrastructure/persistence/supabase-tag.repository.ts:201`, `backend-nest/src/modules/tag/infrastructure/persistence/supabase-tag.repository.spec.ts:125`
- [x] La suppression reste idempotente à zéro ligne et propage les erreurs DB — `backend-nest/src/modules/tag/infrastructure/persistence/supabase-tag.repository.spec.ts:216`
- [x] La course asynchrone du plafond de dix tags et le chemin nominal sont couverts — `frontend/projects/webapp/src/app/pattern/tag-picker/tag-picker.spec.ts:72`, `frontend/projects/webapp/src/app/pattern/tag-picker/tag-picker.spec.ts:85`

### Phase 2 — Contrat et agrégation backend de l'historique

- [ ] Le contrat refuse toutes les fenêtres hors bornes — `months=24&endMonth=1&endYear=2020` est accepté par `shared/schemas.ts:346` mais génère des périodes antérieures au minimum de la réponse défini à `shared/schemas.ts:355`
- [x] Le cas nominal retourne exactement N périodes chronologiques avec des zéros — `backend-nest/src/modules/tag/application/get-tag-history.use-case.spec.ts:38`
- [x] Seuls les liens directs `expense` alimentent séparément le prévu et le réel — `backend-nest/src/modules/tag/infrastructure/persistence/supabase-tag.repository.ts:109`, `backend-nest/src/modules/tag/tag-history.integration.spec.ts:248`
- [x] Un item multi-tagué compte une seule fois par historique de tag — `backend-nest/src/modules/tag/tag-history.integration.spec.ts:269`
- [x] Totaux, moyenne sur N, ratio non plafonné et ratio nul sont calculés après déchiffrement — `backend-nest/src/modules/tag/application/get-tag-history.use-case.spec.ts:57`, `backend-nest/src/modules/tag/application/get-tag-history.use-case.spec.ts:88`
- [x] Le propriétaire lit son historique et un tag absent ou étranger retourne 404 sans lecture des contributions — `backend-nest/src/modules/tag/application/get-tag-history.use-case.spec.ts:105`, `backend-nest/src/modules/tag/tag-history.integration.spec.ts:283`
- [x] Le chemin d'intégration PUL-18 reste en lecture seule et les suites PUL-12 sont incluses dans la validation globale — `backend-nest/src/modules/tag/tag-history.integration.spec.ts:247`, `backend-nest/src/modules/savings-goal/savings-goal-progress.integration.spec.ts:1`

### Phase 3 — Dialog web d'évolution par tag

- [x] L'action reste disponible dès que le compte possède un tag, même sans item tagué — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.ts:97`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.spec.ts:338`
- [x] Le budget consulté ancre la période et un filtre unique présélectionne le tag — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.ts:791`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.spec.ts:371`
- [x] Chaque ouverture et changement de tag ou d'horizon déclenche une lecture avec les bons paramètres — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-dialog.ts:241`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-dialog.spec.ts:119`
- [x] Les quatre horizons et les états chargement, vide, erreur et retry sont distincts — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-dialog.ts:101`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-dialog.spec.ts:140`
- [x] Le dialog borne sa largeur et supprime le débordement horizontal sur mobile — `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-dialog.service.ts:85`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-dialog.ts:69`
- [x] Le graphique reprend toutes les périodes, deux séries et masque cartes, axes, tooltips et texte accessible — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-chart.spec.ts:22`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-chart.spec.ts:34`
- [x] Les couleurs de thème et `prefers-reduced-motion` alimentent la configuration du graphique — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/tag-history/tag-history-chart.ts:195`

### Phase 4 — Écritures complètes et atomiques

- [x] Les réels alloués créent et éditent leurs tags en gardant le `kind` verrouillé — `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/create-dialog/form.ts:127`, `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-dialog.service.ts:202`
- [x] La création complète d'un template transporte `lines[].tagIds` et conserve l'absence du champ — `backend-nest/src/modules/budget-template/application/create-template.use-case.spec.ts:86`
- [x] Une ligne d'épargne conserve simultanément objectif et tags jusque dans le budget généré — `backend-nest/src/modules/budget-template/create-template-with-tags.integration.spec.ts:51`
- [x] Un tag absent ou étranger annule entièrement la création du template — `backend-nest/src/modules/budget-template/create-template-with-tags.integration.spec.ts:144`
- [x] Le RPC conserve le guard utilisateur, les champs FX, le chiffrement en amont et les grants durcis — `backend-nest/supabase/migrations/20260715130000_create_template_with_lines_tags.sql:23`, `backend-nest/supabase/migrations/20260715130000_create_template_with_lines_tags.sql:56`, `backend-nest/supabase/migrations/20260715130000_create_template_with_lines_tags.sql:140`
- [x] La migration combinée propage tags et `savings_goal_id`; les intégrations PUL-12/PUL-18 sont présentes — `backend-nest/supabase/migrations/20260715120000_preserve_tag_and_savings_goal_budget_provisioning.sql:48`, `backend-nest/src/modules/budget-template/create-template-with-tags.integration.spec.ts:51`

### Phase 5 — Recherche, filtres et santé des repositories

- [x] La recherche par nom de tag respecte les budgets sélectionnés, déduplique et trie — `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.spec.ts:606`, `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.spec.ts:639`
- [x] La recherche nominale et les transactions sans tag gardent leur chemin existant — `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.ts:553`
- [x] La navigation entre budgets réinitialise les IDs obsolètes et l'action historique ne dépend pas des tags présents dans le budget — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.ts:379`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.spec.ts:398`
- [x] Les headers recalculent le compte visible et les groupes vides disparaissent — `frontend/projects/webapp/src/app/feature/budget/budget-details/view-models/tag-filter.util.ts:40`, `frontend/projects/webapp/src/app/feature/budget/budget-details/view-models/tag-filter.util.spec.ts:94`
- [x] Le reader de lissage préserve déchiffrement, consommation, compte et erreurs — `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line-spread.reader.ts:20`, `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line-spread.reader.spec.ts:77`
- [x] Le repository budget-line reste sous 1 000 lignes — `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line.repository.ts` = 910 lignes
- [x] Le parcours E2E couvre 3 puis 12 mois, les zéros et le masquage — `frontend/e2e/tests/features/tags-history.spec.ts:48`
- [x] Les écarts corrigés ont des reproductions unitaires ou d'intégration ciblées — `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.spec.ts:146`, `backend-nest/src/modules/tag/tag-history.integration.spec.ts:247`, `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.spec.ts:606`
- [x] Quality, tests unitaires, intégrations, E2E ciblé et migration dry-run sont verts sur le HEAD local — commandes validées sur `a0dc143df33e9bc603079bf0c17bdf92cac7f21f`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | 2 | `shared/schemas.ts:346` | La requête `24 mois / janvier 2020` passe la validation, puis `GetTagHistoryUseCase` construit des périodes 2018-2019 alors que le schéma de réponse interdit toute année avant 2020. Le client valide cette réponse à `frontend/projects/webapp/src/app/core/tag/tag-api.ts:45` et bascule donc en erreur pour une requête pourtant acceptée. | Raffiner `tagHistoryQuerySchema` pour imposer que la première période soit `>= MIN_YEAR`, puis ajouter le test de frontière `24/01/2020` au schéma et au use case. |
| 🟡 warning | code | 4 | `backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.ts:274` | Les updates transaction, budget-line et template-line remplacent les tags avant le chiffrement et le PATCH scalaire (`budget-line.repository.ts:499`, `supabase-budget-template.repository.ts:377`). Si cette seconde étape échoue, l'API retourne une erreur mais le nouveau jeu de tags reste enregistré. Les tests ne couvrent que l'ordre d'échec inverse. | Appliquer colonnes et junctions dans un RPC transactionnel par entité, puis tester qu'un échec scalaire après validation des tags laisse les deux familles de données intactes. |
| 🟡 warning | code | 4 | `backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts:653` | Le bulk template valide d'abord les créations, modifications, suppressions et propagations budget via `apply_template_line_operations`, puis exécute les tags dans un second RPC à la ligne 697. En cas d'échec tags, seules les lignes créées sont compensées; les updates, deletes et budgets déjà modifiés restent partiellement appliqués. | Fusionner opérations scalaires et tags dans une transaction SQL unique; ajouter une intégration où le RPC tags échoue après update/delete et vérifier l'absence de mutation template, budget et objectif d'épargne. |
| 🟡 warning | conform | - | `frontend/projects/webapp/src/app/ui/tag-indicator/tag-indicator.ts:26` | Les noms complets ne sont visibles que dans un tooltip porté par un `span` non focusable. Un utilisateur clavier ne peut pas déclencher ce contenu, contrairement aux badges tooltip existants; cela enfreint l'exigence WCAG AA de focus de `PRODUCT.md:81`. | Rendre la pastille focusable et sémantique (`tabindex="0"`, rôle adapté), puis tester le focus clavier et l'exposition des noms; reprendre le pattern de `currency-conversion-badge.ts:24`. |
| 🟡 warning | rot | - | `PR #502 head/body` | La PR distante pointe sur `855c215825e80cdeaf31662ebdf9705475b12978`, six commits derrière le HEAD revu, et sa description annonce encore l'ancien périmètre sans historique multi-mois ni les validations actuelles. Les checks GitHub verts ne couvrent donc pas ce rapport. | Pousser `a0dc143df33e9bc603079bf0c17bdf92cac7f21f`, actualiser le titre/body et les compteurs de tests, puis attendre les checks du nouveau HEAD avant merge. |
| 🟢 minor | rot | - | `shared/schemas.ts:311` | Le commentaire affirme que `transaction.category` sera remplacé « à terme » et que les junctions arriveront dans de futures PRs, alors que ce diff les livre déjà. | Mettre le commentaire au présent et supprimer la référence aux PRs futures. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 97% (33/34) |
| Files checked | Diff complet de 185 fichiers; plan et 5 phases; schemas partagés; migrations tags/PUL-12; repositories tag, transaction, budget-line et template; UI picker, filtre, indicateur et historique; tests unitaires, intégration et E2E associés |
| Unchecked | Phase 2 #1, fenêtre historique traversant `MIN_YEAR` — fix |
| Unplanned | Historique du plan de revue précédent et note `.claude/agent-memory`; aucun changement produit hors objectif détecté |
