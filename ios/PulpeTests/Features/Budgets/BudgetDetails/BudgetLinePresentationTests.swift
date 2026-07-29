@testable import Pulpe
import Testing

@Suite("Budget line presentation")
struct BudgetLinePresentationTests {
    @Test("spread and goal collapse into one metadata line")
    func combinedMetadata() {
        #expect(
            BudgetLineMixedRow.metadataText(isSpread: true, savingsGoalName: "Maison")
                == "Lissé · objectif Maison"
        )
    }

    @Test("a plain line has no contextual metadata")
    func noMetadata() {
        #expect(BudgetLineMixedRow.metadataText(isSpread: false, savingsGoalName: nil) == nil)
    }

    @Test(
        "spread navigation follows the financial kind",
        arguments: [
            (TransactionKind.saving, "Épargne lissée"),
            (TransactionKind.expense, "Dépense lissée"),
        ]
    )
    func spreadTitle(kind: TransactionKind, expected: String) {
        #expect(SpreadAffordanceButton.title(for: kind) == expected)
    }
}
