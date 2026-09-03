import XCTest

@MainActor
final class PlanBudgetsPendingDismissUITests: XCTestCase {
    func testPendingGenerationBlocksCloseAndSwipeUntilFailure() {
        let app = XCUIApplication()
        app.launchEnvironment["UITEST_SCENARIO"] = "UITEST_PLAN_BUDGETS_PENDING"
        app.launch()

        let sheet = app.descendants(matching: .any)["planBudgetsSheet"]
        let submit = app.buttons["planBudgetsSubmit"]
        XCTAssertTrue(submit.waitForExistence(timeout: 10), app.debugDescription)
        expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: submit)
        waitForExpectations(timeout: 5)
        submit.tap()

        let close = app.buttons["planBudgetsClose"]
        XCTAssertTrue(close.waitForExistence(timeout: 5))
        XCTAssertFalse(close.isEnabled)
        close.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(sheet.exists)
        sheet.swipeDown()
        XCTAssertTrue(sheet.exists)

        app.buttons["planBudgetsFail"].tap()
        expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: close)
        waitForExpectations(timeout: 5)
        close.tap()
        XCTAssertTrue(sheet.waitForNonExistence(timeout: 5))
    }
}
