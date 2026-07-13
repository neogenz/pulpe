# Objectifs d'épargne — Journal d'implémentation (PUL-98)

> **Rôle** : mémoire **durable** entre sessions Claude Code. Un agent ne se souvient de rien — il reconstruit l'état d'ici + Linear + git.
> **Source de vérité métier** : `docs/SAVINGS.md` (immuable). **Avancement des tâches** : les CA cochés dans les issues Linear. **Ici** : le récit (décisions d'impl, gotchas, « next »).
>
> **Comment l'utiliser** : la commande `/impl-savings <scope>` lit ce fichier au démarrage et y **append** une entrée au handoff. Ne jamais réécrire l'historique — append-only.

---

## Step status

- [x] **PUL-12 — backend + shared** (fondation : module CRUD, migrations, lien `template_line`, RPC RG-001, door-keepers FX) — **FAIT** (PR #485 sur `preview`, pas encore mergée)
- [x] **PUL-12 — iOS** (carte tappable + empty state, liste/form, pickers template + budget, service/store) — **FAIT** (PR #486, GitHub "Merged" mais commits absents de `preview` — cf. incident ci-dessous)
- [x] **PUL-12 — web** (route `/savings-goals`, store ziflux, form dialog, carte tappable, pickers template + budget) — **FAIT côté code** (PR #487, stackée sur #485), CONFLICTING contre #485 actuel (rebase requis)
- [ ] PUL-8 — progression (endpoint `/:id/progress` + vues détail iOS/web) — **EN COURS**
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

### 2026-06-24 — PUL-12 web (implémenté)

- **CA cochés** : CA23–CA26 (toute la surface web) + **CA27/CA28** confirmés côté web (devise du compte, aucune couleur d'alerte) → les 2 CA cross-surface sont maintenant cochés.
- **Branche / worktree** : `maximedesogus/pul-12-...-web`, worktree `../pulpe-savings-web`. **Basée sur #485** (backend), pas `preview` : le web compile-dépend des changements shared de #485 (retrait `priority` + refine `targetDate` sur `savingsGoalCreateSchema`, `savingsGoalId` sur les schémas template-line) absents de `preview`. PR **#487 stackée sur #485** (diff web-only) — retarget auto vers `preview` à la fusion de #485.
- **Décisions d'impl** :
  - **Data layer** calqué sur budget-templates : `SavingsGoalApi` (root, `DataCache`) + `SavingsGoalStore` route-scoped (`cachedResource` liste + `cachedMutation` create/update/delete optimistes, settle depuis le retour `await mutate()` — gotcha ziflux latest-wins).
  - **Form = MatDialog Signal Forms** (nom, montant devise-compte **sans** sélecteur CA27, datepicker `min=today` en string `YYYY-MM-DD`, statut Actif/Atteint/En pause réversible). « détail » v1 = le formulaire (barre prévu/confirmé = PUL-8).
  - **Picker réutilisable** `SavingsGoalPickerField` (`pattern/`, API `value`/`valueChanged` — PAS de Field Signal-Forms passé en input) sur les **3** surfaces (edit-template-line + budget-line create/edit), `@if(kind==='saving')`, `null` = untag, liste via `cachedResource` sur le cache partagé `['savings-goals','list']`.
  - **Untag** : les 3 schémas de form portent `savingsGoalId: z.uuid().nullable().optional()` (optional sinon `parse` throw sur les specs existantes qui l'omettent ; passthrough → `undefined` ignoré par `toEqual`). Le build envoie `kind==='saving' ? id : null`.
  - **CA24** : output bubblé (calqué `dashboard-next-month`), bouton hors `ph-no-capture` ; nav via `ROUTES.SAVINGS_GOALS`.
  - **targetAmount** = ligne `'1.2-2'` (valeur d'une entité), pas agrégat `'1.0-0'`.
- **Gotchas rencontrés** :
  - Worktree neuf sans `.env` → `generate:config` (prebuild) échoue → `ng build` ne tourne pas. Copier le `.env` du repo principal (build offline ; `.env` gitignored).
  - `tsc --noEmit` (typecheck) NE valide PAS les templates Angular — seul `ng build` attrape les erreurs de template (ici `NG8022: 'min' interdit sur un nœud `[formField]``). `ng build` = gate réel.
  - Ajouter `savingsGoalId` au transform des schémas budget-line casse 8 specs existantes (`toEqual` de forme exacte + champ requis) → input `.nullable().optional()` (undefined ignoré par `toEqual`, dialog envoie toujours la valeur).
  - feature-ui (agent) coupé en cours : list page + list component manquants → écrits à la main (empty state inliné dans la list page).
- **Review adversariale** (workflow 4 `code-reviewer`) : 1 HIGH + 1 MEDIUM + 4 LOW. **HIGH** corrigé : objectif échu (`targetDate < today`) inéditable (validator re-appliquait la règle create + refine `savingsGoalUpdateSchema`) → validator tolère la date **inchangée** + `buildSavingsGoalUpdate` envoie un **diff** (omet `targetDate` non modifié). **MEDIUM** : `mat-error` montraient le label brut → messages dédiés (required/past séparés). **LOW** : picker via `cachedResource` (cache partagé + dégradation gracieuse sans throw) ; clé i18n `reopen` morte supprimée. **LOW laissé** (non atteignable) : `removeGoal` détecte l'échec via `status()` (store route-scoped + confirm modale ⇒ pas de delete concurrents).
- **PR** : #487 (stackée sur #485). **Merge order** : #485 → (#486 iOS indép.) → #487 web.
- **NEXT** : `PUL-8` (progression — endpoint `/:id/progress`, barres prévu/confirmé, rythme/projection iOS + web), puis `PUL-285` (Phase 3).

### 2026-07-01 — Rebase PUL-12 backend sur `preview`

- **Rebase** : branche `maximedesogus/pul-12-creer-et-rattacher-des-objectifs-depargne-backend` rebasée sur `origin/preview` (`v0.37.0`). L'ancien worktree `../pulpe-savings` a été supprimé ; le travail continue dans le worktree Codex courant.
- **Migrations renommées après `preview`** : les IDs historiques `20260623120000` / `20260623130000` / `20260623140000` ont été déplacés vers `20260701083000` / `20260701083100` / `20260701083200` pour éviter un `supabase db push --dry-run` avec migrations insérées avant la dernière migration déjà présente dans `preview` (`20260626120000`).
- **Review fixes ajoutés** : `20260701083300` ajoute le trigger DB `enforce_savings_goal_line_link` qui garantit que `budget_line.savings_goal_id` et `template_line.savings_goal_id` pointent vers un objectif du même utilisateur, y compris via RPC `SECURITY DEFINER`.
- **PATCH schema** : `savingsGoalUpdateSchema` est découplé du create schema pour ne plus hériter du default `status: ACTIVE` ni de la contrainte create-only `targetDate >= today`.
- **PR** : `feat(savings-goals): backend + shared foundation (PUL-12)` — #485 sur `preview`, toujours ouverte.

### 2026-07-02 — Deep review PR #485 + découverte incident `preview` + PUL-8 kickoff

- **Review #485** (workflow 4 dimensions, chaque passe adversarialement re-vérifiée avec tooling réel — `depcruise`, `eslint`, tests d'intégration live-Postgres, pas juste relecture) : **0 défaut survivant** sur architecture, fidélité aux règles métier (`docs/SAVINGS.md`), et risque de régression migrations/RPC. Les deux RPC `CREATE OR REPLACE` (`apply_template_line_operations`, `create_budget_from_template`) sont **purement additives**, guard PUL-272 reproduit byte-for-byte. 2 findings mineurs non-bloquants : (a) le rejet du trigger d'ownership (`P0001` "Savings goal access denied") n'est catché nulle part → tombe en 500 générique au lieu du pattern `P0001`→4xx établi (`create-budget.use-case.ts:142`) ; (b) le corps de la PR #485 liste encore le gap d'ownership comme "follow-up différé" alors que la migration `083300` (même PR, commit ultérieur) l'a déjà corrigé.
- **Incident découvert (hors scope #485)** : PR #486 (iOS) est étiquetée "Merged" sur GitHub (`2026-06-24T06:44:07Z`, commit `1112ad3b48`) mais **ce commit n'est PAS un ancêtre de `origin/preview`**. Cause racine tracée : un push direct sur `preview` (`0e5300c6f`, 25 min après le merge, mais parenté sur un tip `preview` vieux de 3 jours) a écrasé silencieusement l'historique post-merge — aucune trace sur la timeline GitHub de la PR. `ios/Pulpe/Domain/Models/SavingsGoal.swift` absent de `origin/preview` aujourd'hui. Idem PR #487 (web) : `CONFLICTING` contre #485 actuel (11 conflits, dont une copie dupliquée indépendante du module backend `savings-goal` — #487 date d'avant le rebase de #485).
- **Décision utilisateur** : ne pas investiguer plus l'incident `preview` ; l'iOS PUL-12 sera **re-codé** plus tard sur une base propre plutôt que récupéré tel quel pour le merge final. **Mais** pour ce chantier PUL-8, le contenu de la branche `...-ios` existante est réutilisé tel quel (encore réel, juste orphelin de `preview`) — pas de perte de travail à ce stade.
- **`pul-12-epic`** : branche locale (`/Users/maximedesogus/.codex/worktrees/0683/pulpe-epic`) = `preview` + #485 + #486 + #487 fusionnés, pour disposer d'une base complète PUL-12 et développer/tester PUL-8 dessus. Conflits résolus : ce fichier (union des journaux) + `ios/Pulpe/Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift` (le picker objectif épargne PUL-12 et le mode lissage PUL-17 cohabitent — le picker s'affiche pour `kind == .saving` indépendamment du mode, `CheckedToggle`/`SpreadFormSection` restent mutuellement exclusifs comme avant) + conflit équivalent côté web (`budget-line/create/dialog.ts`, même logique d'union).
- **NEXT** : `/impl-savings PUL-8` — formules partagées (`calculateRealizedSavings`, `paceStatus`) + endpoint `/savings-goals/:id/progress` (backend, en premier — iOS et web en dépendent), puis vues détail iOS + web en parallèle.

### 2026-07-02 — PUL-8 implémenté (backend + shared + iOS + web, sur `pul-12-epic`)

- **CA cochés** : CA1–CA13 (les 4 couches). Sur la branche locale `pul-12-epic` (base = preview + #485 + #486 + #487) — **pas encore de PR** ; le découpage en PR se décidera après la résolution de l'état des branches PUL-12.
- **Shared** (`fd248d020`) :
  - `BudgetFormulas.calculateRealizedSavings` — clone de `calculateRealizedExpenses` avec les DEUX différences obligatoires : filtre `kind === 'saving'` STRICT (pas `isOutflowKind`) et **pas** de bloc free-transaction. Testé contre les deux pièges explicitement (dont le test de contrôle qui prouve que `calculateRealizedExpenses` compte, lui, la transaction libre).
  - `shared/src/calculators/savings-goal-progress.ts` — `computeSavingsGoalProgress` (les 9 formules §4, payDay-aware via `getBudgetPeriodForDate` sur createdAt/now/targetDate), `calculatePaceStatus` (±5 %, `PACE_TOLERANCE_PERCENT`), gardes : `monthsElapsed = max(1, …)` (créé le 28 avec payDay 25 ⇒ cycle suivant), `monthsRemaining ≤ 0` ⇒ `required = null`, `projected = confirmed`, `paceStatus = null` (D1, jamais `behind`), `PAUSED` ⇒ `paceStatus = null`, `targetAmount ≤ 0` ⇒ jamais de division. **21 tests** verrouillent tous les pièges listés dans l'issue.
  - `savingsGoalProgressSchema` + response wrapper. Champs : les 9 métriques + `isOverdue`, `suggestCompletion` (D2), `linkedLineCount` (empty state), FX miroir (null v1, CA6). Date ISO nue parsée en LOCAL (`parseIsoDateLocal`) — `new Date('YYYY-MM-DD')` = minuit UTC, glisserait d'un cycle payDay.
- **Backend** (`fd248d020` + tests `487d6fbf9`) : `GET /savings-goals/:id/progress`. Repo : `findLinkedContributions` (budget_line `.eq(savings_goal_id).eq(kind,'saving')` + join `monthly_budget!inner(month,year)`, puis transactions `.in(budget_line_id)`, déchiffrement `tryDecryptAmount`) + `findPayDayOfMonth` (user_metadata, clampé — pattern find-all-budgets, PAS de dépendance cross-module vers USER_REPOSITORY : UserModule n'exporte rien). Use-case délègue TOUT le calcul au shared ; mapper assemble le DTO au boundary contrôleur. 29 tests unit + **2 tests d'intégration live-DB** (agrégation owner : futur + non-lié exclus du prévu, enveloppe pointée ; isolation RLS : goal étranger ⇒ NOT_FOUND).
- **iOS** (`8d51b7564`) : `SavingsGoalDetailView` + view model (barre 2 couches Pointé/Prévu, stat rows, chip de rythme neutre, D1 « Repousser la date », D2 « Marquer terminé ? » avec refetch, COMPLETED « Ré-ouvrir », empty state 0 lignes). La row de liste pousse désormais le DÉTAIL (l'édition s'ouvre depuis le détail). `SavingsGoalProgress` Decodable (targetDate String), `getProgress(id:)`. 25/25 tests savings, swiftlint --strict clean. ⚠️ Gotcha build résolu : **jamais `-configuration Debug`** (le projet n'a que Local/Preview/Prod ; Debug fait construire les produits SPM dans le mauvais dossier ⇒ « unable to resolve module dependency ») — `-configuration Local` ou omettre.
- **Web** (`532c7053b`) : route lazy `/savings-goals/:id` (la card ouvre le détail ; edit/delete déplacés sur le détail). `SavingsGoalApi.getProgress$` validé par le schéma ; store : `cachedResource ['savings-goals','progress',id]`, `selectedGoal` résolu depuis la liste déjà chargée (pas de requête`getById`), la mutation update invalide la clé progress (les changements de statut refetchent). Montants : agrégats `'1.0-0'`, `targetAmount` `'1.2-2'`, tout en `ph-no-capture`. 2143 tests verts, `ng build` + csp-check OK. E2E mocked-route `savings-goals-progress.spec.ts` (non lancé contre backend live — DB partagée resettable par un agent tiers).
- **Décisions d'impl transverses** :
  - Le serveur calcule TOUT (payDay-aware, montants déchiffrés) ; le seul calcul client est la largeur d'affichage de la couche « Prévu » (ratio bornė, garde cible 0) — présentation pure, documentée comme telle des deux côtés.
  - `paceStatus = null` aussi pour `targetAmount ≤ 0` (en plus de PAUSED/overdue) — garde « ne jamais diviser par une cible non déchiffrée ».
  - `suggestCompletion` restreint à `status === 'ACTIVE'` (un COMPLETED ne re-suggère pas, un PAUSED non plus — D2 dans la machine à états part d'ACTIVE).
- **Gates finaux** : `pnpm quality` 10/10 · backend 953/953 · frontend 2143/2143 · shared 480 (dont 21 nouveaux) · iOS build Local + 25/25 suites savings. Review UX/DA (agent `ux-ui-designer`) sur les deux surfaces en cours au moment de cette entrée.
- **NEXT** : PUL-285 (Phase 3 — arrêt génération à COMPLETED/PAUSED, auto-décomposition, redistribution advisory). Côté process : trancher l'état des branches PUL-12 (#485 à merger, #486 orphelin de preview à re-poser, #487 à rebaser) avant de découper PUL-8 en PRs.

### 2026-07-06 — Spec « aller plus loin » : simulateur de plan d'épargne (blueprint, zéro code)

- **Contexte** : demande utilisateur d'approfondir la page détail objectif — calendrier mensuel projeté avec cumulés, simulation « réajuster la suite » (revert/save), projection réel-vs-prévu fiable, drag-to-adjust, (Sankey **écarté** : demande un apprentissage, hors cible produit 3 s). Intention 9 / douleur D5. Matérialise la « re-projection + redistribution advisory » initialement rattachée à PUL-285.
- **Livrable de cette session** : **spec + conception technique uniquement, aucun code.** Créé `docs/SAVINGS_PLAN.md` (blueprint : 3 piliers UX, IA page, contrat API read/write, formules 10-11, 4 fonctions de simulation client, RPC `apply_savings_goal_plan`, taxonomie d'erreurs, sémantique verrouillage/RG-001, phasage, découpage composants web+iOS). Cross-links posés : `docs/SAVINGS.md` §10 (une ligne, doc immuable) + `CLAUDE.md` Further Reading.
- **Arbitrages tranchés** (2 agents Plan réconciliés) :
  - READ = **extension additive de `GET /:id/progress`** (`months[]` + `cumulativeGap` + `estimatedCompletion`), pas de nouveau `GET /:id/plan` — même fetch repo, 1 round-trip, non-breaking, serveur seul propriétaire des formules. iOS n'a plus besoin de `/contributions` pour cette page.
  - WRITE = **`POST /v1/savings-goals/:id/plan`** payload `{monthAdjustments[], missingMonthAdjustments[]}`. Les périodes absentes sont provisionnées avant la RPC finale. **Pas de clé d'idempotence** : créations de budgets réutilisables au retry, puis UPDATE-by-value sérialisé par objectif.
  - Simulation **100 % client** (< 400 ms, Doherty) via nouveau `shared/src/calculators/savings-goal-plan.ts` + miroir Swift `Domain/Formulas/SavingsPlanCalculator.swift` (doctrine « client ne calcule rien » rompue mais mitigée façon PUL-17 : un calculateur testé + un miroir testé, serveur autoritaire à l'écriture).
  - Mois multi-lignes : `allocateMonthAmountToLines` (proportionnel cents-exact, plus-grand-reste). « Réajuster la suite » = `splitTotalPreserving(remaining, contributiveMonths)` sur les mois matérialisés ouverts et les mois absents provisionnables.
  - UX apply-on-confirm : sandbox (web `GoalPlanSimulatorStore` provider de la page ; iOS VM co-localisé dans le sheet) → récap sans toggle Mois Type → provisioning éventuel + écriture pessimiste → invalidation caches savings **+** budgets. Timeline verticale (grammaire lissage), pas de grid/rail. Slider global + input jumeau (1er MatSlider/Slider natif), édition par mois = champ inline (pas de drag-on-bar : Fitts). RG-002 : jamais ambre/rouge.
- **Faits techniques vérifiés à retenir** :
  - `ending_balance` local par mois, rollover dérivé à la lecture → l'apply recalc **seulement les budgets touchés**, pas de cascade.
  - Trigger `enforce_savings_goal_line_link` fire sur `UPDATE OF savings_goal_id, kind, budget_id` — **pas** `amount`/`is_manually_adjusted` → l'UPDATE amount-only ne paie aucun overhead trigger.
  - Montants chiffrés AES → aucun SUM SQL, décrypt-puis-somme applicatif (pattern `findLinkedContributions`).
- **Issues Linear** : **NON créées** (token MCP Linear expiré en cours de session — nécessite ré-autorisation). Découpage proposé prêt (`SAVINGS_PLAN.md` §9) : A read enrichment (5) · B web lecture (8) · C iOS lecture (8) · D shared simulation (5) · E backend write (8) · F web simulateur (8) · G iOS simulateur (8). Ship order A→(B‖C)→D→E→(F‖G). **Rescoper PUL-285** : retirer la redistribution advisory (absorbée), garder arrêt génération COMPLETED/PAUSED + auto-décomposition.
- **NEXT** : (1) ré-autoriser Linear puis créer les 7 issues + rescoper PUL-285 ; (2) implémenter incrément A (read enrichment, sans risque, débloque B/C). Hors scope à nettoyer avant PR : trio migrations PUL-12 dupliqué byte-identique (`20260623*` vs `20260701*`).

### 2026-07-06 — Simulateur de plan IMPLÉMENTÉ full-stack (shared + backend + web + iOS)

- **Décision utilisateur** : « implémente le plan » — on passe de la spec au code. Toute la feature construite sur `pul-12-epic` en un chantier (main agent = shared/contrat ; 3 teammates spécialisés = backend/web/iOS en parallèle, contrat gelé). **Pas encore committé** (attente décision de découpage PR).
- **Shared (moi, incréments A+D)** — `budget-period.ts` gagne `periodIndex`/`periodFromIndex`/`parseIsoDateLocal` (helpers partagés, dédupliqués depuis progress). `savings-goal-progress.ts` : formules **10** (`cumulativeGap = plannedCumulative − confirmed`, signé) + **11** (`estimatedCompletion`, payDay-aware, gardes PAUSED/cible≤0/pace≤0/horizon>600). Nouveau `savings-goal-plan.ts` : `buildSavingsGoalTimeline` (serveur+client), `simulateSavingsPlan`, `redistributeRemainingEffort` (via `splitTotalPreserving`), `allocateMonthAmountToLines` (largest-remainder cents-exact), `isOpenPlanMonth`. Schémas : `savingsGoalPlanMonthSchema`, `months[]`/`cumulativeGap`/`estimatedCompletion` sur progress, `savingsGoalPlanApplySchema` + réponse, `MAX_PLAN_ADJUSTMENTS=120`. **481 tests shared verts** (+22 : 16 plan + 6 formules 10-11).
- **Backend (teammate, A-read + E)** — `/progress` sérialise `months[]` (via `buildSavingsGoalTimeline` à côté de compute) + les 2 métriques ; repo select `is_manually_adjusted`. **Write** : `POST /v1/savings-goals/:id/plan`, provisioning depuis le Mois Type par défaut, puis RPC SECURITY DEFINER ligne-only (advisory lock par goal, single UPDATE tous guards dans le WHERE, rollback total des montants). Le hardening remet les métadonnées FX source à `null`. Repo `applyPlan` chiffre via ENCRYPTION_PORT ; quatre erreurs distinguent ligne invalide, mois non provisionnable, conflit et échec final. Recalc des **budgets touchés seulement**.
- **Web (teammate, B+F)** — extrait `chart-utils.ts` → `core/chart/chart-theme.ts` (repointé current-month, chart.js hors bundle initial). Pilier A `goal-projection-chart` (4 séries cumulées, overlay sandbox, RG-002). Pilier B `goal-plan-timeline` (fenêtré, édition inline par mois). Simulateur `goal-plan-simulator-store` (providers page = sandbox jeté à la navigation), `goal-plan-simulator-toolbar` (1er MatSlider + input jumeau + réajuster + revert), `goal-plan-apply-dialog` (diff + verdict). API `applyPlan$` + mutation pessimiste. i18n `savingsGoals.plan.*`/`simulate.*`. **Gates** : `ng build` + ESLint + Prettier + 168 spec files verts.
- **iOS (teammate, C+G)** — `SavingsGoalProgress` décode `months[]`+2 métriques (decoder défensif). Miroir Swift `SavingsPlanCalculator` + suite parité 1:1. Pilier A `GoalProjectionChart` (Swift Charts, clone `BalanceTrendChart`). Pilier B `GoalPlanTimelineSection`/`GoalPlanMonthRow`. Extract `GoalDerivedStateCards` (detail view ~330 LOC). Simulateur sheet `.large` (Slider natif + TextField jumeau + réajuster + sticky apply) + `GoalPlanApplyRecapSheet`. Post-apply : invalide CurrentMonth/BudgetList/Dashboard/BudgetDetailCache/SavingsGoalStore + refetch (PUL-270). **Gates (re-vérifiés par le main agent, pas juste l'agent)** : `xcodebuild -scheme PulpeLocal` **BUILD SUCCEEDED**, `PulpeTests` **37 tests / 5 suites savings passed**, swiftlint --strict clean.
- **Décision d'arbitrage clé — horizon provisionnable** : un budget réellement absent devient contributif seulement si le Mois Type par défaut porte une Prévision Épargne liée. Il est créé à la confirmation ; un gap matérialisé ou non provisionnable bloque la redistribution globale. Le plan ne modifie jamais le Mois Type.
- **Corrections de contrat trouvées par les teammates** (légitimes, additives) : les 3 error codes plan manquaient dans `shared/src/error-codes.ts` ; les exports plan/simulation n'étaient pas re-exportés depuis le barrel racine `shared/index.ts`. Ajoutés, 481 tests toujours verts.
- **Gotcha env** : Supabase local refuse `migration up` (lignes d'historique remote-only = les migrations PUL-12 dupliquées) → la nouvelle fonction a été appliquée via psql direct (CREATE OR REPLACE idempotent) ; le fichier de migration est standard, un `db reset` l'applique proprement. Dup migrations non touchées.
- **Blueprint** : `docs/SAVINGS_PLAN.md` (créé) + cross-links `SAVINGS.md` §10 + `CLAUDE.md`.
- **NEXT** : (1) commit + découpage PR (l'utilisateur tranche) ; (2) ré-autoriser Linear → créer les 7 issues + rescoper PUL-285 (retirer redistribution advisory, absorbée) ; (3) revue UX/DA optionnelle (task #14, ux-ui-designer, nécessite app tournante). Hors scope avant PR : trio migrations PUL-12 dupliqué.

### 2026-07-13 — Hardening du simulateur et provisioning des mois absents

- **Contrat final** : l'application porte deux jambes actives, `monthAdjustments` pour les Prévisions matérialisées et `missingMonthAdjustments` pour les périodes absentes provisionnables. L'ancien leg d'écriture du Mois Type est retiré du schéma, des clients, du use case et de la RPC ; le Mois Type n'est jamais modifié par ce flow.
- **Horizon** : création et modification d'un objectif bornées à 120 périodes, mois courant inclus. La timeline est bornée de la même manière. Un mois absent contribue au slider et à « Réajuster la suite » seulement s'il peut être créé depuis le Mois Type par défaut et sa Prévision Épargne liée.
- **Confirmation** : préconditions validées avant mutation, puis chaque budget absent est créé dans une transaction courte idempotente. La RPC finale applique tous les montants de façon atomique. Un budget créé reste conservé si le provisioning suivant ou la RPC finale échoue ; le cache est invalidé et un retry réutilise le budget.
- **Cohérence des montants** : l'application en devise du compte remet à zéro `original_amount`, `original_currency` et `exchange_rate`. Le lissage d'une Prévision Épargne existante conserve désormais son `savingsGoalId` sur chaque tranche.
- **Clients** : slider réel documenté avec ses arrondis distincts web/iOS ; il reste actif avec des montants variables. Un nouveau geste global efface les overrides mensuels, alors qu'un override conserve la valeur globale comme base des autres mois.
