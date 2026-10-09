@testable import Pulpe
import Testing

struct FirstExpenseActivationTests {
    private let budget = TestDataFactory.createBudget(month: 6, year: 2025)

    @Test func isAwaiting_emptyFirstBudget_isTrue() {
        let isAwaiting = FirstExpenseActivation.isAwaiting(
            budget: budget,
            hasTransactions: false,
            budgets: [
                TestDataFactory.createBudgetSparse(id: "current", month: 6, year: 2025),
                TestDataFactory.createBudgetSparse(id: "planned", month: 7, year: 2025)
            ],
            hasLoadedBudgets: true
        )

        #expect(isAwaiting)
    }

    @Test func isAwaiting_monthHoldsATransaction_isFalse() {
        let isAwaiting = FirstExpenseActivation.isAwaiting(
            budget: budget,
            hasTransactions: true,
            budgets: [TestDataFactory.createBudgetSparse(id: "current", month: 6, year: 2025)],
            hasLoadedBudgets: true
        )

        #expect(isAwaiting == false)
    }

    @Test func isAwaiting_earlierBudgetExists_isFalse() {
        let isAwaiting = FirstExpenseActivation.isAwaiting(
            budget: budget,
            hasTransactions: false,
            budgets: [
                TestDataFactory.createBudgetSparse(id: "previous", month: 12, year: 2024),
                TestDataFactory.createBudgetSparse(id: "current", month: 6, year: 2025)
            ],
            hasLoadedBudgets: true
        )

        #expect(isAwaiting == false)
    }

    @Test func isAwaiting_budgetListNotLoaded_isFalse() {
        let isAwaiting = FirstExpenseActivation.isAwaiting(
            budget: budget,
            hasTransactions: false,
            budgets: [],
            hasLoadedBudgets: false
        )

        #expect(isAwaiting == false)
    }

    @Test func isAwaiting_noBudget_isFalse() {
        let isAwaiting = FirstExpenseActivation.isAwaiting(
            budget: nil,
            hasTransactions: false,
            budgets: [],
            hasLoadedBudgets: true
        )

        #expect(isAwaiting == false)
    }

    @Test func source_rawValues_matchWebContract() {
        #expect(FirstExpenseActivation.Source.activationPrompt.rawValue == "activation_prompt")
        #expect(FirstExpenseActivation.Source.addButton.rawValue == "add_button")
    }
}
