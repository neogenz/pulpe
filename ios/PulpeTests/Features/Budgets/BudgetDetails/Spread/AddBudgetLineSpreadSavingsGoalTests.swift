import Foundation
@testable import Pulpe
import Testing

@Suite("AddBudgetLine spread savings-goal wiring")
@MainActor
struct AddBudgetLineSpreadSavingsGoalTests {
    @Test
    func buildCreate_carriesGoalInBothAmountModesAndJSON() throws {
        let calculator = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        let goalId = "goal-1"
        let groupId = "a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

        let total = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(
                name: "Maison", kind: .saving, amount: 90, mode: .total,
                conversion: nil, spreadGroupId: groupId, savingsGoalId: goalId
            )
        )
        let perMonth = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(
                name: "Maison", kind: .saving, amount: 90, mode: .perMonth,
                conversion: nil, spreadGroupId: groupId, savingsGoalId: goalId
            )
        )

        #expect(total.savingsGoalId == goalId)
        #expect(perMonth.savingsGoalId == goalId)
        let encoded = try JSONEncoder().encode(total)
        let json = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        #expect(json["savingsGoalId"] as? String == goalId)
    }

    @Test
    func horizonError_isLocalized() {
        let error = APIError.from(
            code: "ERR_SAVINGS_GOAL_LINE_OUTSIDE_HORIZON",
            message: nil
        )

        #expect(
            error.errorDescription ==
                "Certaines périodes dépassent l'échéance de cet objectif — "
                + "raccourcis le lissage ou choisis un autre objectif"
        )
    }

    @Test
    func spreadCta_namesSavingAndExpense() {
        #expect(
            AddBudgetLineSpreadLogic.ctaTitle(for: .saving) ==
                "Lisser l’épargne"
        )
        #expect(
            AddBudgetLineSpreadLogic.ctaTitle(for: .expense) ==
                "Lisser la dépense"
        )
    }
}
