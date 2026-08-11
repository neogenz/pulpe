# Review: hero rollover clarity (web + iOS)

- **Verdict**: approve
- **Diff**: `origin/preview...HEAD` (+ working tree: aria rounding, invariant comment)
- **Axes run**: code, relevancy
- **Date**: 2026_07_21
- **Findings**: 0 critical, 0 warning, 3 minor

## Phases

Not run — no `plan.md`; this started as a bug investigation, not a planned task.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | conform | - | `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailHero.swift:239` | Rollover shows 2 decimals on iOS vs 0 on web — cross-platform format divergence. | None — intentional. iOS Budget Detail is 2-decimals everywhere (hero amount + 3 pills use `asAmount`); `asCompactCurrency` is banned on this screen by project rule. Intra-screen consistency wins over decimal parity; each platform follows its own currency rule. |
| 🟢 | rot | - | `budget-financial-overview.ts:82` vs `BudgetDetailHero.swift:225` | Disclosure copy differs: web "Report du mois précédent inclus", iOS "Report de \<mois\> inclus". | None — copy is not centralized cross-platform (web transloco vs iOS inline French); intent parity holds, iOS keeps the month it already surfaced. |
| 🟢 | code | - | `budget-financial-overview.ts:184` | `isRolloverPositive` reads `rollover() > 0` while `hasRollover` gates on `Math.round(...) !== 0`; a `(0, 0.5)` value diverges between the two. | None needed — `isRolloverPositive` is only read when `hasRollover` is true, so no sub-half value ever reaches the UI. Noted for the next reader. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | Not run (functional axis has no plan)             |
| Files checked | `budget-financial-overview.ts`, `.spec.ts`, `budget-details-page.html`, `budget-details-page.ts`, `fr.json`, `design-system-page.ts`, `budget-rollover-info/*` (removed), 2 e2e specs, `BudgetDetailHero.swift` |
| Unchecked     | none                                              |
| Unplanned     | none                                              |
