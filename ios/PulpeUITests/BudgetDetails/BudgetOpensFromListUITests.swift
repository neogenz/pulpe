import XCTest

/// The journey build 10 shipped blank: the budgets list, then a month the cache has
/// never seen. The harness seeds no cache, so the page has to start its own load;
/// a body that renders nothing never does, and the tree below stays empty.
@MainActor
final class BudgetOpensFromListUITests: XCTestCase {
    private static let scenario = "UITEST_BUDGET_GOAL_SPREAD_METADATA"
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

    func testColdMonthOpensOnItsHeroWithTitleAndBack() {
        let row = app.buttons["budgetMonthRow-\(Self.budgetId)"]
        XCTAssertTrue(row.waitForExistence(timeout: 15), app.debugDescription)
        row.tap()

        // The hero is the first thing the loaded page draws; a blank page never has it.
        let hero = app.staticTexts["budgetDetailHeroAmount"]
        XCTAssertTrue(hero.waitForExistence(timeout: 15), app.debugDescription)

        let back = app.buttons["BackButton"]
        XCTAssertTrue(back.exists, app.debugDescription)
        XCTAssertEqual(back.label, "Budgets", app.debugDescription)

        // The seed budget is August 2026; the scheme runs in French. SwiftUI puts
        // the title on the bar itself; its title view may be a button (title menu).
        let title = app.navigationBars.matching(
            NSPredicate(format: "identifier MATCHES[c] %@", "ao[uû]t 2026|august 2026")
        ).firstMatch
        XCTAssertTrue(title.exists, app.debugDescription)
    }
}
