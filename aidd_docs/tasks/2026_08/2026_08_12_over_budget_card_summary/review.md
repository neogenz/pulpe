# Review: Résumé des dépassements sur les cartes

- **Verdict**: approve
- **Diff**: `working-tree...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_12
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Aligner les résumés Web et iOS

- [x] Web conserve le pourcentage à 100 % — `budget-item-constants.spec.ts:44`
- [x] Web affiche le dépassement dès que le montant consommé excède le prévu — `budget-item-constants.ts:78`
- [x] Desktop et mobile formatent le dépassement dans la devise active — `budget-grid-card.ts:189`, `budget-grid-mobile-card.ts:241`
- [x] iOS utilise le solde disponible comme seuil exact — `BudgetSection.swift:268`
- [x] Les écrans de détail et les formules financières restent inchangés

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| - | - | - | - | None. | - |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (5/5) |
| Files checked | `budget-item-constants.ts`, `budget-grid-card.ts`, `budget-grid-mobile-card.ts`, `BudgetSection.swift`, tests associés |
| Unchecked     | none |
| Unplanned     | none |
