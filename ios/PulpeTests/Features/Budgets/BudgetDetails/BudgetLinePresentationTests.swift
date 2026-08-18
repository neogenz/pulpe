@testable import Pulpe
import Testing

@Suite("Budget line presentation")
struct BudgetLinePresentationTests {
    @Test("spread and goal collapse into one metadata line")
    func metadataText_whenSpreadAndGoal_combinesIntoOneLine() {
        #expect(
            BudgetLineMixedRow.metadataText(
                isSpread: true,
                savingsGoalName: "Maison",
                isSavingsWithdrawalIncome: false
            ) == "Lissé · objectif Maison"
        )
    }

    @Test("a withdrawal income states its provenance in the metadata line")
    func metadataText_whenSavingsWithdrawalIncome_statesProvenance() {
        #expect(
            BudgetLineMixedRow.metadataText(
                isSpread: false,
                savingsGoalName: nil,
                isSavingsWithdrawalIncome: true
            ) == "Pris sur ton épargne"
        )
    }

    @Test("a plain line has no contextual metadata")
    func metadataText_whenPlainLine_returnsNil() {
        #expect(
            BudgetLineMixedRow.metadataText(
                isSpread: false,
                savingsGoalName: nil,
                isSavingsWithdrawalIncome: false
            ) == nil
        )
    }

    @Test(
        "spread navigation follows the financial kind",
        arguments: [
            (TransactionKind.saving, "Épargne lissée"),
            (TransactionKind.expense, "Dépense lissée"),
        ]
    )
    func spreadTitle_whenFinancialKind_matchesLocalizedLabel(kind: TransactionKind, expected: String) {
        #expect(SpreadAffordanceButton.title(for: kind) == expected)
    }

    @Test("compact consumption keeps the percentage through exactly 100 percent")
    func consumptionSummary_whenAtLimit_keepsPercentage() {
        let consumption = BudgetFormulas.Consumption(
            allocated: 100,
            available: 0,
            percentage: 100
        )

        #expect(
            BudgetLineRow.consumptionSummary(consumption: consumption, currency: .chf)
                == "100 CHF dépensés · 100% utilisé"
        )
    }

    @Test("compact consumption replaces overflow percentage with the exceeded amount")
    func consumptionSummary_whenOverBudget_showsExceededAmount() {
        let consumption = BudgetFormulas.Consumption(
            allocated: 343,
            available: -304,
            percentage: 879
        )

        #expect(
            BudgetLineRow.consumptionSummary(consumption: consumption, currency: .chf)
                == "343 CHF dépensés · Dépassé de 304 CHF"
        )
    }

    @Test("a real fractional overrun keeps its cents")
    func consumptionSummary_whenOverBudgetByFiveCents_showsFiveCents() {
        let consumption = BudgetFormulas.Consumption(
            allocated: 58.55,
            available: -0.05,
            percentage: 100.09
        )

        #expect(
            BudgetLineRow.consumptionSummary(consumption: consumption, currency: .chf)
                == "58.55 CHF dépensés · Dépassé de 0.05 CHF"
        )
    }

    @Test("sub-cent dust stays neutral")
    func consumptionSummary_whenSubCentNegative_doesNotClaimAnOverrun() {
        let consumption = BudgetFormulas.Consumption(
            allocated: 58.504,
            available: -0.004,
            percentage: 100.006
        )

        #expect(
            BudgetLineRow.consumptionSummary(consumption: consumption, currency: .chf)
                == "58.5 CHF dépensés · 100% utilisé"
        )
    }
}
