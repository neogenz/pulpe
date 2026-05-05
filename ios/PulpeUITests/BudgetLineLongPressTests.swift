import XCTest

final class BudgetLineLongPressTests: XCTestCase {
    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
    }

    func testLongPressWithTransactionsOpensLinkedTransactionsSheet() {
        launchScenario("UITEST_BUDGET_LONG_PRESS_WITH_TRANSACTIONS")

        let row = waitForBudgetRow(
            primaryIdentifier: "budgetLineRow-with-transactions",
            fallbackLabel: "Prévision avec transactions"
        )

        row.press(forDuration: 1.0)

        let sheetRoot = app.otherElements["linkedTransactionsSheetRoot"]
        XCTAssertTrue(
            sheetRoot.waitForExistence(timeout: 5),
            "Long press should open linked transactions sheet. " +
            "Debug tree:\n\(app.debugDescription)"
        )
    }

    func testLongPressWithoutTransactionsDoesNotOpenSheet() {
        launchScenario("UITEST_BUDGET_LONG_PRESS_EMPTY")

        let row = waitForBudgetRow(
            primaryIdentifier: "budgetLineRow-empty",
            fallbackLabel: "Prévision simple"
        )

        row.press(forDuration: 1.0)

        let sheetRoot = app.otherElements["linkedTransactionsSheetRoot"]
        XCTAssertFalse(
            sheetRoot.waitForExistence(timeout: 2),
            "Long press should NOT open linked transactions sheet when there are no linked transactions"
        )
    }

    private func launchScenario(_ scenario: String) {
        app = XCUIApplication()
        app.launchArguments += [scenario]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        app.launch()
    }

    private func waitForBudgetRow(
        primaryIdentifier: String,
        fallbackLabel: String,
        timeout: TimeInterval = 10
    ) -> XCUIElement {
        let strategies: [(String, XCUIElement)] = [
            ("buttons[\(primaryIdentifier)]", app.buttons[primaryIdentifier]),
            ("otherElements[\(primaryIdentifier)]", app.otherElements[primaryIdentifier]),
            ("buttons[\(fallbackLabel)]", app.buttons[fallbackLabel]),
            ("staticTexts[\(fallbackLabel)]", app.staticTexts[fallbackLabel]),
        ]

        // First strategy gets the full timeout; fallbacks get 1s each
        for (index, (label, element)) in strategies.enumerated() {
            let wait: TimeInterval = index == 0 ? timeout : 1
            if element.waitForExistence(timeout: wait) {
                if index > 0 {
                    print("⚠️ waitForBudgetRow matched via fallback strategy '\(label)' — check accessibilityIdentifier")
                }
                return element
            }
        }

        XCTFail(
            "Expected row '\(primaryIdentifier)' or '\(fallbackLabel)' to exist. Debug tree:\n\(app.debugDescription)"
        )
        return strategies[0].1
    }
}
