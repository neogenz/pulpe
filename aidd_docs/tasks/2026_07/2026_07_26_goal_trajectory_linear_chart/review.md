# Review: Clarifier la trajectoire d’un objectif

- **Verdict**: approve
- **Diff**: `fe920bffc...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_26
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Adapter la grammaire Chart.js

- [x] Le travail reste isolé sur `codex/goal-trajectory-linear-chart`, au-dessus du correctif fonctionnel `fe920bffc` — `aidd_docs/tasks/2026_07/2026_07_26_goal_trajectory_linear_chart/phase-1.md:56`
- [x] Les séries gardent le réel jusqu’à la période courante et ancrent la projection sur son dernier point — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:165`
- [x] Une échéance dépassée ne reçoit pas de faux repère courant — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.spec.ts:190`
- [x] Cible, épargne et projection restent distinguables par libellé et forme de trait — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:205`
- [x] Le rendu conserve les thèmes clair/sombre et neutralise l’animation en reduced motion — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:41`
- [x] Les calculateurs shared et le contrat API ne sont pas modifiés — `aidd_docs/tasks/2026_07/2026_07_26_goal_trajectory_linear_chart/plan.md:12`

### Phase 2 — Composer la synthèse responsive et accessible

- [x] Le graphe et la synthèse sont côte à côte sur desktop puis empilés sous `lg` sans largeur fixe du canvas — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:55`
- [x] La synthèse utilise `draft.simulatedFinal` pendant la simulation, sinon `projected` — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:220`
- [x] Les trois séries sont identifiables par leur trait, leur libellé et leur valeur — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:79`
- [x] Le mode masqué protège la synthèse, les tooltips et l’annonce accessible — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:101`
- [x] Le mode visible annonce Cible, Épargné et Projection à l’échéance dans l’ordre du DOM — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:238`
- [x] La carte et la synthèse affichent le même montant, et le configurateur verrouille ce montant au dernier point projeté — `frontend/e2e/tests/features/savings-goals-progress.spec.ts:162`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.spec.ts:130`
- [x] Les viewports `1440 × 900`, `768 × 1024` et `390 × 844` utilisent une timeline mensuelle continue jusqu’en août 2027, sans débordement — `frontend/e2e/tests/features/savings-goals-progress.spec.ts:18`
- [x] Les tests ciblés restent contenus au frontend, sans nouvelle dépendance ni modification backend, shared ou iOS — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.spec.ts:1`

## Findings

None.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (14/14) |
| Files checked | `plan.md`, `phase-1.md`, `phase-2.md`, `goal-projection-chart.ts`, `goal-projection-chart.config.ts`, `goal-projection-chart.plugin.ts`, `goal-projection-chart.spec.ts`, `goal-projection-chart.config.spec.ts`, `fr.json`, `savings-goals-progress.spec.ts` |
| Unchecked     | none |
| Unplanned     | none |
