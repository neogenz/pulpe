import SwiftUI

/// The sheets a budget's screens present through `BudgetDetailsRouter.sheet`, in one
/// place so the budget page and `EditTransactionHost` show the same content for the
/// same destination. The presenting view injects its coordinator; the router and the
/// app stores come from the tab.
struct BudgetDetailSheetContent: View {
    let destination: BudgetDetailDestination
    @Environment(BudgetDetailsCoordinator.self) private var coordinator
    @Environment(BudgetDetailsRouter.self) private var router
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(AppState.self) private var appState

    private var toastContext: ToastContext {
        ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
    }

    var body: some View {
        switch destination {
        case .addBudgetLine:
            addBudgetLineSheet
        case .editBudgetLine(let line):
            editBudgetLineSheet(for: line)
        case .previousBudget(let item):
            PreviousBudgetSheet(budgetId: item.id)
        case .realizedBalance:
            RealizedBalanceSheet(
                metrics: coordinator.dataStore.metrics,
                realizedMetrics: coordinator.dataStore.realizedMetrics
            )
        case .spreadOccurrences(let spreadGroupId, let kind):
            // The VIEWED budget's period anchors the display axis (past/current,
            // "Ce mois" vs "Ici"); the live period (today) drives realization.
            let openBudget = coordinator.dataStore.budget
            SpreadOccurrencesSheet(
                spreadGroupId: spreadGroupId,
                kind: kind,
                referencePeriod: BudgetPeriod(
                    month: openBudget?.month ?? Calendar.current.component(.month, from: Date()),
                    year: openBudget?.year ?? Calendar.current.component(.year, from: Date())
                ),
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                currency: userSettingsStore.currency,
                service: coordinator.budgetLineService
            )
        case .spreadExisting(let source):
            // The closure is awaited by the sheet (behind its blocking overlay),
            // so dispatch directly — NO wrapping `Task`, which would return
            // instantly and defeat the in-progress feedback.
            SpreadExistingSheet(source: source, currency: userSettingsStore.currency) { periods in
                let ctx = toastContext
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
        case .savingsWithdrawal(let prefill):
            // Same seam as the additive `onAdd`: the sheet awaits the server, then
            // hands back the confirmed income line so the coordinator grafts it
            // into M and wipes cross-month caches (the paired saving lands in M+1).
            SavingsWithdrawalSheet(prefill: prefill) { incomeLine in
                Task { await coordinator.dispatch(.createSavingsWithdrawal(incomeLine: incomeLine)) }
            }
        }
    }

    /// Anchors the spread on the OPENED budget's period, not the device month
    /// (PUL-17); the income toggle reroutes to the withdrawal preview via the same
    /// `.sheet(item:)` slot (PUL-292).
    @ViewBuilder
    private var addBudgetLineSheet: some View {
        let openBudget = coordinator.dataStore.budget
        AddBudgetLineSheet(
            budgetId: coordinator.dataStore.budgetId,
            anchorMonth: openBudget?.month ?? Calendar.current.component(.month, from: Date()),
            anchorYear: openBudget?.year ?? Calendar.current.component(.year, from: Date()),
            onRequestSavingsWithdrawal: { prefill in
                router.present(.savingsWithdrawal(prefill))
            },
            onAdd: { budgetLine in
                Task { await coordinator.dispatch(.addBudgetLine(budgetLine)) }
            }
        )
    }

    /// The OPENED budget's period bounds which savings goals the line may be
    /// tagged to (PUL-313) — a goal whose deadline precedes it is refused
    /// server-side, so the picker disables it instead of offering the 422.
    @ViewBuilder
    private func editBudgetLineSheet(for line: BudgetLine) -> some View {
        let openBudget = coordinator.dataStore.budget
        EditBudgetLineSheet(
            budgetLine: line,
            userCurrency: userSettingsStore.currency,
            budgetPeriod: openBudget.map { BudgetPeriod(month: $0.month, year: $0.year) }
        ) { updatedLine in
            Task { await coordinator.dispatch(.updateBudgetLine(updatedLine)) }
        }
    }
}
