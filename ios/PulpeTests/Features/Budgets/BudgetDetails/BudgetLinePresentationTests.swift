import Foundation
@testable import Pulpe
import Testing

@Suite("Budget line presentation")
struct BudgetLinePresentationTests {
    /// The recurrence shows as a bare glyph, so the spoken label is the only
    /// place the word survives — these read that label back.
    private func label(
        recurrence: TransactionRecurrence = .fixed,
        name: String = "Loyer",
        metadata: String? = nil,
        tagNames: [String] = []
    ) -> String {
        BudgetLineMixedRow.accessibilityLabel(
            line: TestDataFactory.createBudgetLine(name: name, recurrence: recurrence),
            status: "À pointer",
            amount: Decimal(1000).asCurrency(.chf),
            metadata: metadata,
            tagNames: tagNames
        )
    }

    @Test(
        "the row speaks its recurrence between the kind and the name",
        arguments: [
            (TransactionRecurrence.fixed, "Mensuel"),
            (TransactionRecurrence.oneOff, "Ponctuel"),
        ]
    )
    func accessibilityLabel_whenRecurrence_speaksItAfterTheKind(
        recurrence: TransactionRecurrence,
        expected: String
    ) {
        #expect(label(recurrence: recurrence).hasPrefix("Dépense · \(expected) · Loyer"))
    }

    @Test("a line with nothing else to say still carries its recurrence")
    func accessibilityLabel_whenNoMetadataNorTag_stillSpeaksTheRecurrence() {
        // `metadataText` is nil here: before the glyph, the tertiary line of such
        // a row rendered nothing at all.
        #expect(
            BudgetLineMixedRow.metadataText(
                isSpread: false,
                savingsGoalName: nil,
                isSavingsWithdrawalIncome: false
            ) == nil
        )
        #expect(label().contains("Mensuel"))
    }

    /// Only one rhythm has a glyph. The word is the whole of what a ponctuel line
    /// says, so a change that put a symbol back would break this pair.
    @Test("only the monthly rhythm carries a mark", arguments: [
        (TransactionRecurrence.fixed, "repeat"),
        (TransactionRecurrence.oneOff, String?.none),
    ])
    func icon_marksTheMonthlyRhythmOnly(recurrence: TransactionRecurrence, expected: String?) {
        #expect(recurrence.icon == expected)
    }

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
