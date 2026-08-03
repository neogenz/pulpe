import Foundation
@testable import Pulpe
import Testing

/// What the deletion sheet lets the user choose, and what it never puts up for
/// choice. The toggles decide the fate of prévisions and transactions; they have
/// no say over an income already drawn from the goal (PUL-329), so that list is
/// the same under every mode.
@Suite("GoalDeletionSheet")
struct GoalDeletionSheetTests {
    /// A transaction is attached by default on purpose: without one the sheet
    /// hides its second toggle and the third mode becomes unreachable.
    private func makeImpact(
        budgetCount: Int = 0,
        transactionCount: Int = 1,
        withdrawals: [SavingsGoalWithdrawal] = []
    ) -> SavingsGoalDeletionImpact {
        TestDataFactory.createDeletionImpact(
            summary: TestDataFactory.createDeletionSummary(
                budgetCount: budgetCount,
                transactionCount: transactionCount,
                withdrawals: withdrawals
            ),
            // Reversed on purpose: putting them back in order is the
            // presentation's job, and this is what proves it does.
            budgets: (0..<budgetCount).reversed().map { index in
                SavingsGoalDeletionBudget(
                    budgetId: "budget-\(index)",
                    month: (index % 12) + 1,
                    year: 2026 + index / 12,
                    lines: []
                )
            },
            withdrawals: withdrawals
        )
    }

    @Test("deletion presentation defaults to goal only")
    func deletionPresentation_defaultsToGoalOnly() {
        let presentation = GoalDeletionPresentation(impact: makeImpact())

        #expect(presentation.mode == .goalOnly)
        #expect(presentation.command?.mode == .goalOnly)
    }

    @Test("transaction deletion requires forecasts and existing transactions")
    func deletionPresentation_transactionSelectionIsNested() {
        var presentation = GoalDeletionPresentation(impact: makeImpact())

        presentation.setDeletesTransactions(true)
        #expect(presentation.mode == .goalOnly)

        presentation.setDeletesForecasts(true)
        presentation.setDeletesTransactions(true)
        #expect(presentation.mode == .goalForecastsAndTransactions)

        presentation.setDeletesForecasts(false)
        #expect(presentation.mode == .goalOnly)

        presentation.show(makeImpact(transactionCount: 0))
        presentation.setDeletesForecasts(true)
        presentation.setDeletesTransactions(true)
        #expect(presentation.mode == .goalAndForecasts)
    }

    @Test("deletion presentation keeps and sorts all 76 budgets")
    func deletionPresentation_keepsAllBudgets() {
        let presentation = GoalDeletionPresentation(impact: makeImpact(budgetCount: 76))

        #expect(presentation.budgets.count == 76)
        #expect(presentation.budgets.first?.month == 1)
        #expect(presentation.budgets.first?.year == 2026)
        #expect(presentation.budgets.last?.month == 4)
        #expect(presentation.budgets.last?.year == 2032)
    }

    // MARK: - Kept incomes (PUL-329)

    private func makeWithdrawal(id: String, amount: Decimal) -> SavingsGoalWithdrawal {
        SavingsGoalWithdrawal(
            transactionId: id,
            budgetId: "budget-1",
            name: "Apport cuisine",
            transactionDate: Date(timeIntervalSince1970: 1_753_000_000),
            amount: amount
        )
    }

    @Test("the kept incomes and their total survive every deletion mode")
    func withdrawals_areTheSameUnderEveryMode() {
        var presentation = GoalDeletionPresentation()
        presentation.show(makeImpact(withdrawals: [
            makeWithdrawal(id: "tx-1", amount: 4500),
            makeWithdrawal(id: "tx-2", amount: 500.55),
        ]))

        var seenModes: [SavingsGoalDeletionMode] = []
        for (deletesForecasts, deletesTransactions) in [(false, false), (true, false), (true, true)] {
            presentation.setDeletesForecasts(deletesForecasts)
            presentation.setDeletesTransactions(deletesTransactions)
            seenModes.append(presentation.mode)

            #expect(presentation.withdrawals.map(\.transactionId) == ["tx-1", "tx-2"])
            #expect(presentation.withdrawalTotal == Decimal(string: "5000.55"))
        }

        // Guards the loop itself: three distinct modes were actually exercised.
        #expect(seenModes == [.goalOnly, .goalAndForecasts, .goalForecastsAndTransactions])
    }

    @Test("a goal nobody drew from announces nothing to keep")
    func withdrawals_areEmptyWithoutAnyIncome() {
        var presentation = GoalDeletionPresentation()
        presentation.show(makeImpact(withdrawals: []))

        #expect(presentation.withdrawals.isEmpty)
        #expect(presentation.withdrawalTotal == 0)
    }

    /// A stale impact must not leave the previous goal's incomes on screen while
    /// the fresh preview loads.
    @Test("reloading the impact clears what the previous one announced")
    func withdrawals_areClearedWhileTheImpactReloads() {
        var presentation = GoalDeletionPresentation()
        presentation.show(makeImpact(withdrawals: [makeWithdrawal(id: "tx-1", amount: 4500)]))

        presentation.show(nil)

        #expect(presentation.withdrawals.isEmpty)
        #expect(presentation.withdrawalTotal == 0)
    }
}
