import Foundation

/// Pointing an announced savings-goal withdrawal (PUL-329). Same gesture as every
/// other line, but the line itself is never checked: the server refuses to check a
/// live source, and a checked source would count the income twice. Pointing
/// realizes it instead, with one allocated Réel for what is left; un-pointing deletes
/// that Réel, which returns the money to the goal.
extension BudgetDetailsCoordinator {
    /// What the screen still has to do once the gesture has been handled here.
    enum PlannedWithdrawalPointOutcome: Equatable {
        /// Realized, or the undo confirmation is up: nothing to open.
        case handled
        /// The direct realization was refused (goal balance, conflict, network):
        /// the prefilled form lets the user lower the amount.
        case openRealizationForm
        /// Several Réels realize the line: which one to remove is the user's call.
        case openLineDetail
    }

    /// Typed rather than routed through `dispatch(_:)`: the view navigates on the
    /// outcome, like the form-driven mutations in `+Mutations.swift`.
    func pointPlannedWithdrawal(
        _ line: BudgetLine,
        context: ToastContext,
        payDayOfMonth: Int?,
        now: Date = .now
    ) async -> PlannedWithdrawalPointOutcome {
        guard !syncStore.isSyncing(lineId: line.id) else { return .handled }
        let realized = BudgetFormulas.calculateConsumption(for: line, transactions: dataStore.transactions).allocated
        guard !line.isPointed(allocated: realized) else { return unpointPlannedWithdrawal(line) }

        // Same payload the prefilled form submits untouched: the line's name, what
        // is left to take out, today within this budget's period, pointed. The server
        // inherits the goal.
        let data = AddAllocatedTransactionLogic.buildCreate(
            for: line,
            input: .init(
                name: line.name,
                amount: line.amount - realized,
                transactionDate: realizationDate(payDayOfMonth: payDayOfMonth, now: now),
                isChecked: true,
                conversion: nil,
                tagIds: nil
            )
        )
        // Spans the server call, so the row's disc can tell a refusal from a success.
        syncStore.markSyncing(lineId: line.id)
        defer { syncStore.clearSyncing(lineId: line.id) }
        do {
            _ = try await createAllocatedTransaction(data)
            return .handled
        } catch {
            context.toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            return .openRealizationForm
        }
    }

    /// Today when it falls in the displayed budget's period, else the period's first day,
    /// so a past or future month never gets a movement dated outside it. Mirrors the
    /// web's `computeBudgetPeriodDateConstraints` default.
    private func realizationDate(payDayOfMonth: Int?, now: Date) -> Date {
        guard let budget = dataStore.budget else { return now }
        let period = BudgetPeriodCalculator.periodDates(
            month: budget.month, year: budget.year, payDayOfMonth: payDayOfMonth
        )
        let calendar = Calendar.current
        let periodEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: period.endDate))
            ?? period.endDate
        return now >= period.startDate && now < periodEnd ? now : period.startDate
    }

    private func unpointPlannedWithdrawal(_ line: BudgetLine) -> PlannedWithdrawalPointOutcome {
        let realizations = dataStore.transactions.filter { $0.budgetLineId == line.id }
        guard realizations.count == 1, let realization = realizations.first else { return .openLineDetail }
        syncStore.presentPlannedWithdrawalUndo(.init(
            realization: realization,
            goalName: line.sourceSavingsGoalName ?? ""
        ))
        return .handled
    }
}
