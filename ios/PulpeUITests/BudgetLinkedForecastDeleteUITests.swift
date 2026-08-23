import XCTest

@MainActor
final class BudgetLinkedForecastDeleteUITests: XCTestCase {
    func testDeletePresentsLinkedForecastChoiceOnFirstTap() {
        let app = XCUIApplication()
        app.launchEnvironment["UITEST_SCENARIO"] = "UITEST_BUDGET_LINKED_FORECAST_DELETE"
        app.launch()

        let budget = app.buttons["budgetMonthRow-linked-delete-budget"]
        XCTAssertTrue(budget.waitForExistence(timeout: 10))
        budget.tap()

        let line = app.buttons["budgetLineMixedRowButton-linked-delete-line"]
        XCTAssertTrue(line.waitForExistence(timeout: 10))
        line.tap()

        let detail = app.descendants(matching: .any)["budgetLineDetailPageRoot"]
        XCTAssertTrue(detail.waitForExistence(timeout: 10))
        app.buttons["Plus d'options"].tap()
        app.buttons["Supprimer"].tap()

        let alert = app.alerts["Quelles prévisions supprimer ?"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.buttons["Supprimer septembre seulement"].exists)
        XCTAssertTrue(alert.buttons["Supprimer août et septembre"].exists)
        XCTAssertTrue(alert.buttons["Ne rien supprimer"].exists)

        alert.buttons["Ne rien supprimer"].tap()
        XCTAssertTrue(detail.waitForExistence(timeout: 5))
        XCTAssertFalse(alert.exists)
    }
}
