# Objectifs d'épargne — Journal d'implémentation (PUL-98)

> **Rôle** : mémoire **durable** entre sessions Claude Code. Un agent ne se souvient de rien — il reconstruit l'état d'ici + Linear + git.
> **Source de vérité métier** : `docs/SAVINGS.md` (immuable). **Avancement des tâches** : les CA cochés dans les issues Linear. **Ici** : le récit (décisions d'impl, gotchas, « next »).
>
> **Comment l'utiliser** : la commande `/impl-savings <scope>` lit ce fichier au démarrage et y **append** une entrée au handoff. Ne jamais réécrire l'historique — append-only.

---

## Step status

- [ ] **PUL-12 — backend + shared** (fondation : module CRUD, migrations, lien `template_line`, RPC RG-001, door-keepers FX) — **NEXT**
- [ ] PUL-12 — iOS (carte tappable, liste/détail/form, pickers template + budget, service)
- [ ] PUL-12 — web (route `/savings-goals`, store, pickers, carte)
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
