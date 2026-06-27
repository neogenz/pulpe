import SwiftUI

// MARK: - Routing

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
            SpreadOccurrencesSheet(
                spreadGroupId: spreadGroupId,
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                currency: userSettingsStore.currency
            )
        }
    }
}
