# Review: Clarifier la trajectoire d’un objectif

- **Verdict**: approve
- **Diff**: `fe920bffc...WORKTREE`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_26
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Adapter la grammaire Chart.js

- [x] Le travail reste isolé sur `codex/goal-trajectory-linear-chart`, au-dessus du correctif fonctionnel `fe920bffc` — `aidd_docs/tasks/2026_07/2026_07_26_goal_trajectory_linear_chart/phase-1.md:56`
- [x] Les séries gardent le réel jusqu’à la période courante et ancrent la projection sur son dernier point canonique — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:122`
- [x] Une échéance dépassée ne reçoit pas de faux repère courant — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.spec.ts:190`
- [x] Cible, épargne et projection restent distinguables par libellé, forme de trait et deux couleurs contrastées — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:208`
- [x] Le rendu conserve les thèmes clair/sombre et neutralise l’animation en reduced motion — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:40`
- [x] Les calculateurs shared et le contrat API ne sont pas modifiés — `shared/src/calculators/savings-goal-progress.ts:278`

### Phase 2 — Composer la synthèse responsive et accessible

- [x] Le graphe et la synthèse sont côte à côte sur desktop puis empilés sous `lg` sans largeur fixe du canvas — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:55`
- [x] La synthèse utilise `draft.simulatedFinal` pendant la simulation, sinon `projected` — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:220`
- [x] Les trois séries sont identifiables par leur trait, leur libellé, leur valeur et leur couleur — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:79`
- [x] Le mode masqué protège la synthèse, les tooltips et l’annonce accessible — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:238`
- [x] Le mode visible annonce Cible, Épargné et Projection à l’échéance dans l’ordre du DOM — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:244`
- [x] La carte Projection à l’échéance, le dernier point projeté et la synthèse utilisent le même endpoint canonique — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:713`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:150`
- [x] Les viewports `1440 × 900`, `768 × 1024` et `390 × 844` utilisent une timeline mensuelle continue sans débordement — `frontend/e2e/tests/features/savings-goals-progress.spec.ts:133`
- [x] Le correctif n’ajoute aucune dépendance et la parité iOS demandée reprend les mêmes couleurs et formes — `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:59`

## Findings

None.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (14/14) |
| Files checked | `plan.md`, `phase-1.md`, `phase-2.md`, `goal-projection-chart.ts`, `goal-projection-chart.config.ts`, `goal-projection-chart.plugin.ts`, `goal-projection-chart.spec.ts`, `goal-projection-chart.config.spec.ts`, `savings-goal-detail-page.ts`, `savings-goal-detail-page.spec.ts`, `GoalProjectionChart.swift`, `GoalProgressCard.swift` |
| Unchecked     | none |
| Unplanned     | parité iOS et différenciation bleu/vert, explicitement demandées après le plan |
