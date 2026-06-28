import SwiftUI

// MARK: - Routing

/// Push + sheet destination builders for `BudgetDetailsView`, split out to keep
/// the main view file under the feature's 350-LOC budget (same precedent as the
/// `BudgetLineDetailPage` ↔ `+Hero` split). The members used here
/// (`coordinator`, `router`, `userSettingsStore`, `toastContext`) are declared
/// non-private on the view for this reason.
extension BudgetDetailsView {
    @ViewBuilder
    func pushDestination(for route: BudgetLinePushRoute) -> some View {
        switch route {
        case .lineDetail(let lineId):
            BudgetLineDetailPage(
                lineId: lineId,
                onEditLine: { line in router.present(.editBudgetLine(line)) }
            )
        case .addAllocatedTx(let lineId):
            AddAllocatedTransactionPage(lineId: lineId)
        case .editTx(let transactionId):
            EditTransactionPage(transactionId: transactionId)
        }
    }

    @ViewBuilder
    func sheetContent(for destination: BudgetDetailDestination) -> some View {
        switch destination {
        case .addBudgetLine:
            // Anchor the spread on the OPENED budget's period, not the device month (PUL-17).
            let openBudget = coordinator.dataStore.budget
            AddBudgetLineSheet(
                budgetId: coordinator.dataStore.budgetId,
                anchorMonth: openBudget?.month ?? Calendar.current.component(.month, from: Date()),
                anchorYear: openBudget?.year ?? Calendar.current.component(.year, from: Date())
            ) { budgetLine in
                Task { await coordinator.dispatch(.addBudgetLine(budgetLine)) }
            }
        case .editBudgetLine(let line):
            EditBudgetLineSheet(budgetLine: line, userCurrency: userSettingsStore.currency) { updatedLine in
                Task { await coordinator.dispatch(.updateBudgetLine(updatedLine)) }
            }
        case .previousBudget(let item):
            PreviousBudgetSheet(budgetId: item.id)
        case .realizedBalance:
            RealizedBalanceSheet(
                metrics: coordinator.dataStore.metrics,
                realizedMetrics: coordinator.dataStore.realizedMetrics
            )
        case .spreadOccurrences(let spreadGroupId):
            // The VIEWED budget's period anchors the display axis (past/current,
            // "Ce mois" vs "Ici"); the live period (today) drives realization.
            let openBudget = coordinator.dataStore.budget
            SpreadOccurrencesSheet(
                spreadGroupId: spreadGroupId,
                referencePeriod: BudgetPeriod(
                    month: openBudget?.month ?? Calendar.current.component(.month, from: Date()),
                    year: openBudget?.year ?? Calendar.current.component(.year, from: Date())
                ),
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                currency: userSettingsStore.currency
            )
        case .spreadExisting(let source):
            SpreadExistingSheet(source: source, currency: userSettingsStore.currency) { periods in
                let ctx = toastContext
                Task {
                    switch source.sourceType {
                    case .budgetLine:
                        await coordinator.dispatch(
                            .spreadBudgetLineFromExisting(lineId: source.id, periods: periods, ctx)
                        )
                    case .transaction:
                        await coordinator.dispatch(
                            .spreadTransactionFromExisting(txId: source.id, periods: periods, ctx)
                        )
                    }
                }
            }
        }
    }
}
