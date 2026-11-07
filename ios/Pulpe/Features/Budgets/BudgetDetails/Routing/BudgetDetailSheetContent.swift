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
        case .addBudgetLine(let kind):
            addBudgetLineSheet(kind: kind)
        case .movement(let lineId, let transactionId):
            BudgetMovementSheet(lineId: lineId, transactionId: transactionId)
        case .editBudgetLine(let line):
            editBudgetLineSheet(for: line)
        case .previousBudget(let item):
            PreviousBudgetSheet(budgetId: item.id)
        case .realizedBalance:
            BudgetDetailsRealizedBalanceSheet()
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
            SpreadExistingSheet(
                source: source,
                currency: userSettingsStore.currency,
                ledger: isOpenedMonth(month: source.month, year: source.year) ? monthLedger : nil
            ) { periods in
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
            let isOpened = isOpenedMonth(month: prefill.anchorMonth, year: prefill.anchorYear)
            SavingsWithdrawalSheet(
                prefill: prefill,
                ledger: isOpened ? monthLedger : nil,
                spreadInstead: isOpened
                    ? SpreadExistingSource.largestSpreadableExpense(
                        in: monthLedger, month: prefill.anchorMonth, year: prefill.anchorYear
                    )
                    : nil,
                onSpreadInstead: { router.present(.spreadExisting($0)) },
                onAdd: { incomeLine in
                    Task { await coordinator.dispatch(.createSavingsWithdrawal(incomeLine: incomeLine)) }
                }
            )
        case .catchUp(let focusLineId):
            CatchUpSheet(
                ledger: monthLedger,
                focusLineId: focusLineId,
                month: coordinator.dataStore.budget?.month ?? Calendar.current.component(.month, from: Date()),
                currency: userSettingsStore.currency
            ) { updatedLine in
                Task { await coordinator.dispatch(.updateBudgetLine(updatedLine)) }
            }
        }
    }

    /// Whether `month`/`year` is the budget this page has open: only then does
    /// `monthLedger` describe it.
    private func isOpenedMonth(month: Int, year: Int) -> Bool {
        guard let budget = coordinator.dataStore.budget else { return false }
        return budget.month == month && budget.year == year
    }

    /// The opened month as the disponible reads it.
    private var monthLedger: MonthLedger {
        MonthLedger(
            lines: coordinator.dataStore.budgetLines,
            transactions: coordinator.dataStore.ledgerTransactions,
            rollover: coordinator.dataStore.budget?.rollover.orZero ?? 0
        )
    }

    /// Anchors the spread on the OPENED budget's period, not the device month
    /// (PUL-17); the income toggle reroutes to the withdrawal preview via the same
    /// `.sheet(item:)` slot (PUL-292).
    @ViewBuilder
    private func addBudgetLineSheet(kind: TransactionKind) -> some View {
        let openBudget = coordinator.dataStore.budget
        AddBudgetLineSheet(
            budgetId: coordinator.dataStore.budgetId,
            anchorMonth: openBudget?.month ?? Calendar.current.component(.month, from: Date()),
            anchorYear: openBudget?.year ?? Calendar.current.component(.year, from: Date()),
            templateId: openBudget?.templateId,
            initialKind: kind,
            ledger: monthLedger,
            onRequestSavingsWithdrawal: { prefill in
                router.present(.savingsWithdrawal(prefill))
            },
            onTemplateLineAdded: {
                Task { await coordinator.dispatch(.reloadCurrentBudget) }
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
            budgetPeriod: openBudget.map { BudgetPeriod(month: $0.month, year: $0.year) },
            ledger: monthLedger,
            templateId: openBudget?.templateId
        ) { updatedLine in
            Task { await coordinator.dispatch(.updateBudgetLine(updatedLine)) }
        }
    }
}
