import XCTest

/// Pointing a line from the budget detail ledger: the disc is the control, the leading
/// swipe is the second path, and neither opens the line's detail.
@MainActor
final class BudgetDetailsPointingUITests: XCTestCase {
    private static let scenario = "UITEST_BUDGET_GOAL_SPREAD_METADATA"
    private static let lineId = "goal-spread-line"
    private static let budgetId = "goal-spread-budget"

    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-\(Self.scenario)"]
        app.launchEnvironment["UITEST_SCENARIO"] = Self.scenario
        app.launch()
    }

    /// The harness lands on the budgets list; the month row opens the ledger.
    private func waitForRow() -> XCUIElement {
        let budget = app.buttons["budgetMonthRow-\(Self.budgetId)"]
        XCTAssertTrue(budget.waitForExistence(timeout: 15), app.debugDescription)
        budget.tap()
        let row = app.buttons["budgetLineMixedRowButton-\(Self.lineId)"].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15), app.debugDescription)
        showEveryLine()
        return row
    }

    /// The ledger opens on "À pointer", which hides a line the moment it is pointed.
    private func showEveryLine() {
        let menu = app.descendants(matching: .any).matching(
            NSPredicate(format: "label == %@ OR label == %@", "Filtre d'état", "Status filter")
        ).firstMatch
        XCTAssertTrue(menu.waitForExistence(timeout: 5), app.debugDescription)
        menu.tap()
        let all = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Tout voir", "See all")
        ).firstMatch
        XCTAssertTrue(all.waitForExistence(timeout: 5), app.debugDescription)
        let hittable = NSPredicate(format: "isHittable == true")
        XCTWaiter().wait(for: [expectation(for: hittable, evaluatedWith: all)], timeout: 5)
        all.tap()
    }

    func testTappingTheDiscPointsAndUnpointsTheLine() {
        _ = waitForRow()

        let disc = pointingDisc()
        XCTAssertTrue(disc.waitForExistence(timeout: 5))
        disc.tap()
        XCTAssertTrue(pointedDisc().waitForExistence(timeout: 5), "Tapping the ring should point the line")

        pointedDisc().tap()
        XCTAssertTrue(pointingDisc().waitForExistence(timeout: 5), "Tapping the filled disc should unpoint the line")
    }

    func testLeadingSwipePointsTheLineWithoutOpeningIt() {
        let row = waitForRow()

        let start = row.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.5))
        let end = start.withOffset(CGVector(dx: 140, dy: 0))
        start.press(forDuration: 0.05, thenDragTo: end)

        XCTAssertTrue(pointedDisc().waitForExistence(timeout: 5), "A leading swipe should point the line")
        XCTAssertFalse(
            app.navigationBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Budget'")).firstMatch
                .waitForExistence(timeout: 1) && app.staticTexts["budgetLineDetailRoot"].exists,
            "A swipe must not open the line detail"
        )
        XCTAssertTrue(row.waitForExistence(timeout: 2), "The row should still be on the ledger")
    }

    func testSwipeDuringTapCompletionDoesNotToggleTwice() {
        let row = waitForRow()
        let disc = pointingDisc()
        XCTAssertTrue(disc.waitForExistence(timeout: 5))

        disc.tap()
        let start = row.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 140, dy: 0)))

        XCTAssertTrue(pointedDisc().waitForExistence(timeout: 2), "The tap should point the line")
        XCTAssertFalse(
            pointingDisc().waitForExistence(timeout: 1),
            "A swipe during completion must not send a second toggle"
        )
    }

    /// The swipe takes gesture priority over the row; a vertical pan must still scroll the ledger.
    func testVerticalPanOnARowStillScrollsTheLedger() {
        // Accessibility type makes the ledger taller than the screen, so it has room to scroll.
        app.terminate()
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "accessibility3"
        app.launch()
        let row = waitForRow()
        let before = row.frame.minY

        let start = row.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -200)))

        XCTAssertLessThan(row.frame.minY, before, "A vertical pan on a row should scroll the ledger")
        XCTAssertFalse(pointedDisc().exists, "A vertical pan must not point the line")
    }

    private func pointingDisc() -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "À pointer", "To check")).firstMatch
    }

    private func pointedDisc() -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Pointé", "Checked")).firstMatch
    }
}
