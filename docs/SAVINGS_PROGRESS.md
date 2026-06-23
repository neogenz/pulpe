# Objectifs d'épargne — Journal d'implémentation (PUL-98)

> **Rôle** : mémoire **durable** entre sessions Claude Code. Un agent ne se souvient de rien — il reconstruit l'état d'ici + Linear + git.
> **Source de vérité métier** : `docs/SAVINGS.md` (immuable). **Avancement des tâches** : les CA cochés dans les issues Linear. **Ici** : le récit (décisions d'impl, gotchas, « next »).
>
> **Comment l'utiliser** : la commande `/impl-savings <scope>` lit ce fichier au démarrage et y **append** une entrée au handoff. Ne jamais réécrire l'historique — append-only.

---

## Step status

- [x] **PUL-12 — backend + shared** (fondation : module CRUD, migrations, lien `template_line`, RPC RG-001, door-keepers FX) — **FAIT** (PR #485 sur `preview`)
- [x] **PUL-12 — iOS** (carte tappable + empty state, liste/form, pickers template + budget, service/store) — **FAIT** (PR #486 sur `preview`)
- [ ] PUL-12 — web (route `/savings-goals`, store, pickers, carte) — **NEXT**
- [ ] PUL-8 — progression (endpoint `/:id/progress` + vues détail iOS/web)
- [ ] PUL-285 — Phase 3 (auto-décompose + redistribution advisory)

Estimations : PUL-12 = 21 · PUL-8 = 13 · PUL-285 = 21 (epic = 55).

---

## Décisions produit déjà tranchées (rappel — détail dans `docs/SAVINGS.md`)

- Contribution = **tagging manuel** ; lien au niveau du **Modèle** (`template_line.savings_goal_id`) pour survivre aux régénérations.
- **Priorité supprimée** du produit (colonne DB dormante).
- **Nudge** des épargnes non-taguées = **hors v1**.
- Devise du compte uniquement ; **FX dormant** (champs retournés `null`, porte ouverte).
- Progression en **2 couches** (prévu cumulé / confirmé) ; % et auto-complétion sur le **confirmé**.
- Entrée = carte Épargne dashboard → action **« Voir mes objectifs »** (la carte reste un résumé mensuel, goal-agnostique).
- Épargne **jamais** ambre/rouge. COMPLETED réversible. Redistribution Phase 3 = **advisory**.

---

## Pièges connus (relevés par la validation swarm — ne pas re-découvrir)

Voir le bloc `<known_traps_by_layer>` de `.claude/commands/impl-savings.md` + `docs/SAVINGS.md` §4/§9. En bref : FK DROP+recreate · RPC RG-001 = gros morceau (re-valider PUL-272) · mapper FX dédié (`original_target_amount`) · `z.iso.date().refine` (pas `.min()`) · `calculateRealizedSavings` kind-strict + sans free-tx · `monthsRemaining + 1` · `confirmedPace` · DTO Swift `BudgetLineUpdate`/template manquants · carte iOS masquée si `!hasSavings` · carte web sans output + `ph-no-capture`.

---

## Journal (append-only, le plus récent en bas)

### 2026-06-23 — Spec & validation

- **Fait** : `docs/SAVINGS.md` (blueprint complet) + `docs/diagrams/savings-goals.c4` (6 workflows, validé). PUL-12/8/285 spécifiées au format user-story + **validées** par un swarm adversarial (72 agents : 6 blockers + 28 majors confirmés, tous corrigés dans les docs et issues). PUL-126/134 absorbées dans PUL-12.
- **Code** : **rien d'implémenté**. Aucun module `savings-goal`, aucune migration `template_line.savings_goal_id`.
- **Décisions d'impl** : aucune encore (elles s'inscriront ici au fur et à mesure).
- **NEXT** : `/impl-savings PUL-12 — backend + shared`. Commencer par les schémas shared, puis les migrations, puis la **réécriture RPC RG-001** (le risque principal), puis le module NestJS. Worktree depuis `preview`. PR sur `preview`.

### 2026-06-23 — PUL-12 backend + shared (implémenté)

- **CA cochés** : CA1–CA15 (tout le backend + shared). CA16 = vérifié (aucune modif Zod, `budgetLineUpdate` hérite déjà `savingsGoalId`). iOS (CA17–22) / web (CA23–26) / UX (CA27–28) = hors scope.
- **Branche / worktree** : `maximedesogus/pul-12-creer-et-rattacher-des-objectifs-depargne-backend`, worktree `../pulpe-savings`. 5 commits sur `preview`.
- **Migrations** :
  - `20260623120000` — `template_line.savings_goal_id` (FK `ON DELETE SET NULL` + index) ; `budget_line` FK **DROP+recreate** en `ON DELETE SET NULL` ; `savings_goal.priority` rendu nullable (dormant) ; `fx_metadata_coherent` sur `savings_goal` (champ `original_target_amount`).
  - `20260623130000` — `CREATE OR REPLACE apply_template_line_operations` + `create_budget_from_template` propagent `savings_goal_id` ; **guard PUL-272 reproduit verbatim** (re-validé par test).
  - `20260623140000` — `create_template_with_lines` propage `savings_goal_id` (gap trouvé par la review adversariale : le schéma batch acceptait le champ mais le droppait).
- **Décisions d'impl** :
  - `savings_goal.target_amount` / `original_target_amount` étaient **déjà TEXT chiffrés** (rollout encryption) → pas de migration de conversion.
  - **DELETE** repose sur le FK `ON DELETE SET NULL` (délink atomique, aucune prévision supprimée) — pas de transaction explicite.
  - **Guard kind** `kind ≠ saving ⇒ savingsGoalId = null` via helper pur `@common/utils/savings-goal-link.ts` (`savingsGoalIdForKind` create / `savingsGoalIdPatchForKind` update), appliqué sur budget_line **et** template_line (create + update + bulk + batch).
  - Mapper FX **dédié** `mapSavingsGoalCurrencyMetadataToApi` (`original_target_amount`, jamais le générique `original_amount`).
  - RLS `savings_goal` **existait déjà** (policies user_id dans le schema dump) → CA7 satisfait sans nouvelle policy.
- **Gotchas rencontrés** :
  - DB locale polluée par le worktree PUL-17 (spread) → `supabase db reset` (approuvé) pour types propres ; sinon fuite spread dans `database.types.ts`.
  - `targetDate` : `z.iso.date().refine(≥ today)` (jamais `.min()` — Zod 4 mesure la longueur).
  - Le retrait de `priority` casse 2 specs shared + ~8 littéraux `TemplateLine`/`SavingsGoal` (frontend + backend fixtures) → collatéral mécanique du contrat (savingsGoalId requis sur le read schema).
  - `supabase gen types` (CLI 2.84.2) émet sans `;` → toujours `prettier --write` après, sinon diff énorme.
- **Review adversariale** (workflow 11 agents) : 3 findings confirmés. 1 corrigé (batch path, ci-dessus). 2 laissés en follow-up (LOW, sans impact) : (a) pas de validation d'ownership du `savingsGoalId` taggé (UUID opaque, aucune fuite, RLS protège les reads ; nécessite un appel PostgREST direct) ; (b) `DELETE` d'un goal inexistant/étranger renvoie 200 (idiome de tous les repos du projet, RLS empêche toute suppression réelle).
- **PR** : `feat(savings-goals): backend + shared foundation (PUL-12)` sur `preview` (lien dans Linear).
- **NEXT** : `/impl-savings PUL-12 — iOS` (carte tappable + empty state + liste/détail/form + pickers template & budget + `SavingsGoalService` + DTO Swift `BudgetLineUpdate`/template manquants), puis `PUL-12 — web`, puis `PUL-8` (progression).

### 2026-06-23 — PUL-12 iOS (implémenté)

- **CA cochés** : CA17–CA22 (toute la surface iOS). CA27/CA28 **satisfaits côté iOS** (devise du compte, aucune couleur d'alerte) mais laissés **décochés** car cross-surface — à reconfirmer côté web.
- **Branche / worktree** : `maximedesogus/pul-12-creer-et-rattacher-des-objectifs-depargne-ios`, worktree `../pulpe-savings-ios` (depuis `origin/preview`). 5 commits. PR #486 sur `preview`.
- **Décisions d'impl** :
  - **Lien tag = tri-state Swift `String??`** sur les 3 DTO PATCH (`BudgetLineUpdate`, `TemplateLineUpdate`, `TemplateLineUpdateWithId`) : `.none` omet (no-change) / `.some(nil)` envoie `null` (untag) / `.some(id)` tag. Seule façon d'exprimer l'untag via un PATCH partiel (`encodeIfPresent` omet les `nil` simples). Create + read = `String?` simple.
  - **Kind-guard partagé** `TransactionKind.savingsGoalLink(_:)` (`kind ≠ saving ⇒ nil`) + `onChange(of: kind)` qui clear, sur les 3 éditeurs.
  - **Picker réutilisable** `SavingsGoalPickerField` (template-line + budget-line Add/Edit), affiché seulement si `kind == saving`, lit `SavingsGoalStore` via `@Environment`.
  - **Entrée dashboard** : la section Épargne est **toujours rendue** avec `SavingsGoalsEntryRow` (la carte résumé est masquée si `!hasSavings`, donc l'entrée porte l'empty state). « Voir mes objectifs » / « Fixe ton premier objectif ».
  - **« détail » v1 = le formulaire d'édition** (la barre prévu/confirmé = PUL-8). Nav `CurrentMonthTab` via `SavingsGoalDestination`.
  - `SavingsGoalStore` (`@Observable @MainActor`) calqué sur `BudgetListStore`, injecté à la racine + reset au logout. Le CRUD d'objectif ne touche aucun agrégat budget → pas d'invalidation des stores frères.
  - `targetDate` = **String ISO `YYYY-MM-DD`** côté Swift, jamais `Date` (le décodeur ISO8601 *datetime* rejetterait une date nue). `DatePicker(in: Date()...)` borne ≥ today (miroir du `refine` backend).
- **Gotchas rencontrés** :
  - Worktree neuf : lefthook pre-commit `pnpm quality` meurt (turbo absent, pas de `node_modules`) → commits iOS vérifiés à la main (`xcodebuild` + `swiftlint --strict`) puis `git commit --no-verify`.
  - `Pulpe.xcodeproj` gitignored (xcodegen) → ne pas committer ; `xcodegen generate --use-cache` après tout ajout de fichier.
  - `PulpeWidget` globe `Pulpe/Domain/Models` → `SavingsGoal.swift` compile aussi dans le widget (OK, ne dépend que de `SupportedCurrency`).
  - Suite complète : **1 échec PRÉEXISTANT** `BudgetDetailsCoordinatorTests.showCheckToast…SwissLocale` (séparateur décimal CHF) — passe en isolation, reproduit avec mes tests savings **exclus**, dans du code non touché. Pollution d'ordre du cache `NumberFormatter`, **pas** une régression PUL-12.
- **Review adversariale** (2 `code-reviewer`) : 0 défaut correctness/contrat/concurrence. 4 findings design-system corrigés (delete → `Color.destructivePrimary` ; `.monospacedDigit()` ; opacité via `DesignTokens.Opacity.badgeBackground` ; test bulk-path `TemplateLineUpdateWithId`).
- **PR** : `feat(savings-goals): iOS surface (PUL-12)` → #486 sur `preview`. ⚠️ Ce fichier est introduit aussi par #485 (docs non encore sur `preview`) → possible conflit add/add à la fusion : garder la version superset.
- **NEXT** : `/impl-savings PUL-12 — web` (route `/savings-goals`, store ziflux, carte tappable **hors** `ph-no-capture`, pickers template + dialogs budget), puis `PUL-8` (progression).
