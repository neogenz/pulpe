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
        context: ToastContext
    ) async -> PlannedWithdrawalPointOutcome {
        guard !syncStore.isSyncing(lineId: line.id) else { return .handled }
        let realized = BudgetFormulas.calculateConsumption(for: line, transactions: dataStore.transactions).allocated
        guard !line.isPointed(allocated: realized) else { return unpointPlannedWithdrawal(line) }

        // Same payload the prefilled form submits untouched: the line's name, what
        // is left to take out, today, pointed. The server inherits the goal.
        let data = AddAllocatedTransactionLogic.buildCreate(
            for: line,
            input: .init(
                name: line.name,
                amount: line.amount - realized,
                transactionDate: .now,
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
