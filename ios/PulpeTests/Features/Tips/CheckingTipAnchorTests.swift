@testable import Pulpe
import Testing

/// The checking tip anchors on exactly one disc — the first line the user can point.
struct CheckingTipAnchorTests {
    private func item(
        _ id: String, isChecked: Bool = false, isRollover: Bool = false
    ) -> BudgetDetailsScreenState.LineItem {
        BudgetDetailsScreenState.LineItem(
            line: TestDataFactory.createBudgetLine(id: id, isChecked: isChecked, isRollover: isRollover),
            consumption: BudgetFormulas.Consumption(allocated: 0, available: 0, percentage: 0),
            isSyncing: false
        )
    }

    @Test func skipsPointedAndRolloverLines_picksFirstPointable() {
        let anchor = BudgetDetailsScreenState.checkingTipLineId(in: [
            .init(kind: .income, items: [item("rollover", isRollover: true), item("salary", isChecked: true)]),
            .init(kind: .expense, items: [item("rent"), item("food")])
        ])
        #expect(anchor == "rent")
    }

    @Test func allPointed_noAnchor() {
        let anchor = BudgetDetailsScreenState.checkingTipLineId(in: [
            .init(kind: .expense, items: [item("rent", isChecked: true)])
        ])
        #expect(anchor == nil)
    }
}
