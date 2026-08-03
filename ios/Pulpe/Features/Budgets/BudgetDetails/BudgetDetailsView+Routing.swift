import SwiftUI

// MARK: - Initial transaction (PUL-329)

/// Opens the transaction a `BudgetDestination.transaction` push came for, once
/// the budget's data actually contains it.
///
/// Waiting on the transaction rather than on the budget matters: the editor
/// resolves its model from the loaded set and auto-pops when it finds nothing, so
/// pushing too early would open the page and immediately close it. Fires once —
/// after that the user owns the stack, including a deliberate back.
private struct InitialTransactionPush: ViewModifier {
    let transactionId: String?
    let transactions: [Transaction]
    let router: BudgetDetailsRouter

    @State private var didPush = false

    private var isLoaded: Bool {
        guard let transactionId else { return false }
        return transactions.contains { $0.id == transactionId }
    }

    func body(content: Content) -> some View {
        content.onChange(of: isLoaded, initial: true) { _, loaded in
            guard loaded, !didPush, let transactionId else { return }
            didPush = true
            router.push(.editTx(transactionId: transactionId))
        }
    }
}

extension View {
    func openingInitialTransaction(
        _ transactionId: String?,
        in transactions: [Transaction],
        router: BudgetDetailsRouter
    ) -> some View {
        modifier(
            InitialTransactionPush(
                transactionId: transactionId,
                transactions: transactions,
                router: router
            )
        )
    }
}

// MARK: - Routing

/// Push + sheet destination builders for `BudgetDetailsView`, split out to keep
/// the main view file under the feature's 350-LOC budget (same precedent as the
/// `BudgetLineDetailPage` ↔ `+Hero` split). The members used here
/// (`coordinator`, `router`, `userSettingsStore`, `toastContext`) are declared
/// non-private on the view for this reason.
extension BudgetDetailsView {
    /// Lives here rather than on the view so the page stays under its LOC budget;
    /// every consumer is a routing or mutation call site anyway.
    var toastContext: ToastContext {
        ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
    }

    @ViewBuilder
    func pushDestination(for route: BudgetLinePushRoute) -> some View {
        switch route {
        case .lineDetail(let lineId):
            BudgetLineDetailPage(
                lineId: lineId,
                tagNamesById: tagStore.namesById,
                onEditLine: { line in router.present(.editBudgetLine(line)) }
            )
        case .addAllocatedTx(let lineId):
            AddAllocatedTransactionPage(lineId: lineId)
        case .editTx(let transactionId):
            EditTransactionPage(transactionId: transactionId)
        }
    }

    /// Extracted from `sheetContent(for:)` to keep that switch under the
    /// function-length budget. Anchors the spread on the OPENED budget's period,
    /// not the device month (PUL-17); the income toggle reroutes to the
    /// withdrawal preview via the same `.sheet(item:)` slot (PUL-292).
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

    @ViewBuilder
    func sheetContent(for destination: BudgetDetailDestination) -> some View {
        switch destination {
        case .addBudgetLine:
            addBudgetLineSheet
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
}
