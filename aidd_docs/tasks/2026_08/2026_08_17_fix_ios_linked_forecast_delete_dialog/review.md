# Review: corriger le dialogue iOS de suppression des prévisions liées

- **Verdict**: approve
- **Diff**: `origin/preview...4d782e346fb667f8023408f1f9c1cfd2577f4b28`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_17
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Présenter et verrouiller le choix sur le détail visible

- [x] Le choix lié est attaché à la destination visible dès le premier tap et l'ancien présentateur a disparu de la vue parente — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailPage.swift:68`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift:176`
- [x] La sortie sûre réinitialise uniquement le choix tandis que les confirmations conservent les scopes `repayment` et `pair` ainsi que la garde anti-orpheline du coordinateur — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailPage.swift:73`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailPage.swift:79`, `ios/Pulpe/Features/Budgets/BudgetDetails/Coordinator/BudgetDetailsCoordinator+SoftDelete.swift:19`, `ios/PulpeTests/Features/Budgets/BudgetDetails/BudgetDetailsCoordinatorSavingsWithdrawalTests.swift:50`
- [x] La copie retire les montants signés et les verbes ambigus, puis nomme la prise d'épargne, sa remise et les mois dynamiques — `ios/Pulpe/Features/Budgets/BudgetDetails/SavingsWithdrawal/BudgetLineDetailPage+SavingsWithdrawalDelete.swift:14`, `ios/Pulpe/Features/Budgets/BudgetDetails/SavingsWithdrawal/BudgetLineDetailPage+SavingsWithdrawalDelete.swift:23`
- [x] Les deux suppressions portent le rôle destructif, l'annulation ne mute rien et les cinq nouvelles clés sont traduites en allemand, anglais, français et italien — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailPage.swift:73`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailPage.swift:76`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailPage.swift:79`, `ios/Pulpe/Resources/Localizable.xcstrings:16264`, `ios/Pulpe/Resources/Localizable.xcstrings:22664`, `ios/Pulpe/Resources/Localizable.xcstrings:25148`
- [x] Le harness fournit le couple août/septembre déterministe et le XCUITest touche « Supprimer » une fois, attend le choix sans retour, vérifie ses trois actions puis retrouve le détail après annulation ; la validation fournie confirme 1/1 XCUITest et 8/8 tests coordinateur — `ios/Pulpe/App/BudgetLongPressUITestHarness.swift:185`, `ios/Pulpe/App/BudgetLongPressUITestHarness.swift:269`, `ios/PulpeUITests/BudgetLinkedForecastDeleteUITests.swift:20`, `ios/PulpeUITests/BudgetLinkedForecastDeleteUITests.swift:29`, `ios/PulpeTests/Features/Budgets/BudgetDetails/BudgetDetailsCoordinatorSavingsWithdrawalTests.swift:15`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (5/5) |
| Files checked | `plan.md`, `debug.md`, `phase-1.md`, `BudgetLongPressUITestHarness.swift`, `PulpeApp.swift`, `SavingsGoalIntervalUITestHarness.swift`, `BudgetDetailsView.swift`, `BudgetLineDetailPage.swift`, `BudgetDetailsView+SavingsWithdrawalDelete.swift`, `BudgetLineDetailPage+SavingsWithdrawalDelete.swift`, `Localizable.xcstrings`, `BudgetLinkedForecastDeleteUITests.swift`, `BudgetDetailsCoordinator+SoftDelete.swift`, `BudgetDetailsCoordinator+Mutations.swift`, `BudgetDetailsCoordinatorSavingsWithdrawalTests.swift`, `ios/CLAUDE.md`, `ios/DESIGN.md` |
| Unchecked     | none |
| Unplanned     | none |
