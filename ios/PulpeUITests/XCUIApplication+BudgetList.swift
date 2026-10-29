import XCTest

extension XCUIApplication {
    /// A month row on the budgets list. The list folds the closed months of the year being
    /// lived in, and the UI-test seeds sit in 2026, closed once the clock passes them: the
    /// fold is opened first when it hides the row.
    func budgetMonthRow(_ budgetId: String, timeout: TimeInterval = 15) -> XCUIElement {
        let rowId = "budgetMonthRow-\(budgetId)"
        let toggleId = "closedMonthsToggle"
        // Whichever appears first says which: the row in an open block, or the fold over it.
        _ = buttons
            .matching(NSPredicate(format: "identifier == %@ OR identifier == %@", rowId, toggleId))
            .firstMatch
            .waitForExistence(timeout: timeout)
        let row = buttons[rowId]
        if !row.exists, buttons[toggleId].exists {
            buttons[toggleId].tap()
        }
        return row
    }
}
