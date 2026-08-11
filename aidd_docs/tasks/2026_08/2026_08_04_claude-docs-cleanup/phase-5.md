---
status: done
---

# Instruction: Mémoires auto

119 fichiers, dont 47 sains. La famille `reference_*` est la plus saine du corpus (30 KEEP sur 46) : ce sont des notes de terrain non redécouvrables par lecture du code. Les pertes sont ailleurs — du travail livré jamais retiré, et des « leçons » qui ne sont que du professionnalisme générique déjà couvert par `~/.claude/CLAUDE.md`.

Tous les chemins sont relatifs à `~/.claude/projects/-Users-maximedesogus-workspace-perso--projets-pulpe-workspace/memory/`.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
memory/
├── MEMORY.md                                                  ✏️ réindexer après DELETE/MERGE
├── feedback_dry_ios_components.md                             ❌ générique + doublon
├── feedback_ios_shared_components.md                          ❌ générique + doublon
├── feedback_no_magic_design_values.md                         ❌ dupliqué par 01-standards/no-magic-design-values.md
├── feedback_research_before_iterating_swiftui.md              ❌ contenu intégral dans swiftui.md:320-322
├── feedback_no_centimes.md                                    ❌ pierre tombale d'une règle abrogée
├── reference_ios_taptarget_frame_grows_hstack_row.md          ❌ promue dans swiftui-hit-areas.md:40-71
├── project_ios_biometric_snapshot_rotation.md                 ❌ remplacée par project_pul278_…
├── project_pul12_savings_backend_review.md                    ❌ stack fermée, orpheline de l'index
├── project_pul12_savings_web_shipped.md                       ❌ route vers une branche mergée
├── feedback_two_decimals_ios_budget_detail.md                 ✏️ TODO déjà appliqué + lignes fausses
├── project_pul17_spread_architecture.md                       ✏️ contrat obsolète
├── project_turnstile_empty_token_intentional_demo_throttle.md ✏️ suggère railway login, interdit ailleurs
├── project_security_audit_2026_07_20.md                       ✏️ all-clear périmé par 2 migrations
├── reference_git_push_silent_noop_needs_refspec.md            ✏️ wikilink mort + phrase dupliquée
├── reference_supabase_local_db_cross_worktree_pollution.md    ✏️ ⟵ fusionner avec ci-dessous
├── reference_supabase_migration_up_legacy_history_mismatch.md ✏️ ⟶ résoudre par objectif, pas par interdiction
├── reference_ci_setup_job_action_manifest_parse_failure.md    ✏️ ⟶ fusionner dans reference_ci_ios_job_timeout_cancelled.md
└── reference_ci_ios_job_timeout_cancelled.md                  ✏️ renommer sur un titre non-iOS
```

## Tasks to do

### `1)` Supprimer les 9 mémoires mortes

> Ne supprimer qu'après avoir vérifié soi-même la cible nommée. Un skeptic a déjà refusé plusieurs suppressions de ce lot ; celles-ci ont survécu.

1. `feedback_dry_ios_components` et `feedback_ios_shared_components` : conseil générique, doublon l'un de l'autre.
2. `feedback_no_magic_design_values` : la règle `.claude/rules/01-standards/no-magic-design-values.md` la couvre et s'active sur `ios/**/*.swift`.
3. `feedback_research_before_iterating_swiftui` : payload intégral dans `swiftui.md:320-322`.
4. `reference_ios_taptarget_frame_grows_hstack_row` : promue dans `swiftui-hit-areas.md:40-71`, qui s'active sur tout `.swift` alors que la mémoire non. Avant de supprimer, **porter le « pourquoi »** : l'écart 13,7 pt → 37,7 pt inversait le ratio de proximité 2:1 dont dépend l'architecture des sections de la home. La règle a le chiffre 24 pt, pas ce raisonnement.
5. `feedback_no_centimes` : abrogée le 2026-05-08, ne subsiste que « hors Budget Detail, à statuer cas par cas » — ce qui n'est pas une instruction. Supprimer, et vérifier que `feedback_two_decimals_ios_budget_detail` ne renvoie plus vers elle.
6. `project_ios_biometric_snapshot_rotation` : comportement remplacé par `project_pul278_session_persistence_rootcause`.
7. `project_pul12_savings_web_shipped` et `project_pul12_savings_backend_review` : stack PUL-12 fermée, branche mergée. La seconde est déjà orpheline de l'index.

### `2)` Corriger les mémoires qui routent vers du faux

1. `project_pul17_spread_architecture.md:12` : contrat obsolète, génère un payload rejeté par l'API. Aligner sur `project_pul287_spread_intent_contract` (`{mode, months[], FX}`).
2. `project_turnstile_empty_token_intentional_demo_throttle` : supprimer la suggestion `railway login`, que `reference_railway_mcp_auth_expiry_cli_fallback` interdit en majuscules. Conserver les 4 citations de veille et les deux remédiations négatives — ce sont exactement les « corrections » qu'un reviewer futur proposerait à tort.
3. `feedback_two_decimals_ios_budget_detail` : le TODO « sites à corriger : `BudgetLineMixedRow.swift` lignes 182, 195, 204, 212 » **est déjà appliqué** — le fichier utilise `asCurrency` et les montants sont désormais lignes 214/235/280. Supprimer le TODO et les numéros de ligne, garder la règle.
4. `project_security_audit_2026_07_20` : l'all-clear « RLS enabled on all 11 tables, do not re-audit » couvre désormais une surface non auditée — deux migrations postérieures (`20260723120000`, `20260802120000_add_savings_goal_withdrawals.sql`). Redater le constat comme baseline. **Conserver impérativement** le paragraphe sur le faux positif `WITH CHECK` : c'est un vrai faux positif Postgres (l'omission de `WITH CHECK` retombe sur `USING`) que trois agents ont soulevé indépendamment.

### `3)` Fusionner les paires redondantes

1. Les deux mémoires Supabase locales partagent la même cause (`project_id = "backend-nest"`, 38 worktrees sur un volume) et la même chaîne d'erreur verbatim. Fusionner en résolvant **par objectif** plutôt que par interdiction : prouver une migration → `psql` ; typegen fidèle à la branche → `reset` après avoir demandé. Le « surtout pas db reset (interdit par CLAUDE.md) » est inconditionnel à tort — l'interdiction du CLAUDE.md vise prod et linked.
2. Contenu à préserver absolument dans la fusion : le cas de fuite typegen PUL-292 (un reset voisin depuis une lignée divergente a fait **supprimer** une colonne de `database.types.ts` par `generate-types:local` ; le correctif est `git checkout -- database.types.ts`, le fichier commité faisant autorité) et le piège `UPDATE OF col` (la liste de colonnes vit sur `pg_trigger`, un `CREATE OR REPLACE FUNCTION` seul laisse le cas élargi silencieusement non déclenché).
3. Fusionner `reference_ci_setup_job_action_manifest_parse_failure` dans `reference_ci_ios_job_timeout_cancelled`, qui porte déjà une table de discriminants. **Condition** : renommer la cible sur un titre non-iOS (l'échec `Set up job` peut toucher n'importe quel job), sinon la signature se retrouve enterrée sous un titre iOS et on perd la découvrabilité qui justifiait le fichier séparé.
4. `reference_git_push_silent_noop_needs_refspec` : ne **pas** fusionner. Deux causes racines indépendantes, dont une (le modificateur d'historique zsh `$VAR:`) n'a rien à voir avec le wrapper git. Correction simple : repointer le wikilink mort vers la mémoire rtk et supprimer la phrase dupliquée sur le porcelain.

### `4)` Réparer l'index et les liens

1. `MEMORY.md` : réindexer après les 9 suppressions et les 3 fusions. L'index est la seule porte d'entrée — une entrée morte est un `Read` gaspillé.
2. Ajouter les 2 mémoires orphelines si elles survivent : `feedback_bg_session_worktree_commit_hook`, `project_pul12_savings_backend_review` (celle-ci est en suppression, donc ne rien ajouter).
3. Corriger les 8 wikilinks `[[...]]` morts : 6 sont en kebab-case au lieu de snake_case (`ci-supabase-sb-keys-runner-image` → `reference_ci_supabase_sb_keys_runner_image`, `feedback-branch-before-prod-claim`, `project-appstateflowbridge-logout-deflake`, `project-pul278-session-persistence-rootcause`, `reference-ios-code-signing-no-skips-keychain-tests`, `reference-simulator-widget-gallery-chronod`) ; 2 pointent vers des fichiers jamais écrits (`reference_git_diff_external_sem_wrapper`, `reference_ziflux_upgrade_checklist`) — les supprimer ou écrire la mémoire.
4. Vérifier que `MEMORY.md` reste sous **200 lignes et 25 KB** : au-delà, tout est ignoré au chargement. Actuellement 139 l / 19,1 K.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| 1    | Les 9 fichiers ont disparu ; pour chacun, la cible qui le remplace a été ouverte et contient bien le contenu ; le « pourquoi » du tap-target vit dans `swiftui-hit-areas.md` |
| 2    | Aucune mémoire ne route vers un contrat d'API rejeté, une commande interdite ailleurs, ou un TODO déjà appliqué             |
| 3    | Une seule mémoire couvre la pollution DB locale, et elle tranche par objectif ; le cas PUL-292 et le piège `pg_trigger` y survivent ; la mémoire CI porte un titre non-iOS |
| 4    | Zéro lien mort dans `MEMORY.md`, zéro fichier orphelin, zéro wikilink `[[...]]` sans cible ; `MEMORY.md` < 200 l et < 25 KB |
| —    | Les mémoires `reference_*` jugées saines sont intactes                                                                     |
