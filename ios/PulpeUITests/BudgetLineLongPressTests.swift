import XCTest

@MainActor
final class BudgetLineLongPressTests: XCTestCase {
    private struct DisplayMode {
        let name: String
        let dynamicType: Bool
        let darkMode: Bool
    }

    private static let goalSpreadScenario = "UITEST_BUDGET_GOAL_SPREAD_METADATA"
    private static let goalSpreadLineId = "goal-spread-line"
    private static let goalSpreadBudgetId = "goal-spread-budget"
    /// Fixture data, not display copy: the harness seeds this name, so it stays a
    /// literal while the app is localized.
    private static let goalName = "Voyage au Japon"
    /// The month the spread fixture plans, as the plan row identifies itself.
    private static let goalSpreadPlanMonth = "2026-8"
    /// Fixture amount of the August occurrence — the figure both destinations owe.
    private static let goalSpreadAmount = "413"

    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
    }

    func testLongPressWithTransactionsOpensLinkedTransactionsSheet() {
        launchScenario("UITEST_BUDGET_LONG_PRESS_WITH_TRANSACTIONS")

        let row = waitForBudgetRow(identifier: "budgetLineRow-with-transactions")

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

        let row = waitForBudgetRow(identifier: "budgetLineRow-empty")

        row.press(forDuration: 1.0)

        let sheetRoot = app.otherElements["linkedTransactionsSheetRoot"]
        XCTAssertFalse(
            sheetRoot.waitForExistence(timeout: 2),
            "Long press should NOT open linked transactions sheet when there are no linked transactions"
        )
    }

    // One method per display mode rather than a loop: `continueAfterFailure = false`
    // aborts the whole method on the first assertion, so a loop would report the
    // failing mode and silently never exercise the ones after it.

    func testGoalAndSpreadMetadataRemainUsableInLightLarge() {
        assertGoalAndSpreadMetadataRemainUsable(
            DisplayMode(name: "light-large", dynamicType: false, darkMode: false)
        )
    }

    func testGoalAndSpreadMetadataRemainUsableInDarkLarge() {
        assertGoalAndSpreadMetadataRemainUsable(
            DisplayMode(name: "dark-large", dynamicType: false, darkMode: true)
        )
    }

    func testGoalAndSpreadMetadataRemainUsableInLightAccessibility3() {
        assertGoalAndSpreadMetadataRemainUsable(
            DisplayMode(name: "light-accessibility3", dynamicType: true, darkMode: false)
        )
    }

    func testGoalAndSpreadMetadataRemainUsableInDarkAccessibility3() {
        assertGoalAndSpreadMetadataRemainUsable(
            DisplayMode(name: "dark-accessibility3", dynamicType: true, darkMode: true)
        )
    }

    private func assertGoalAndSpreadMetadataRemainUsable(
        _ mode: DisplayMode,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        launchGoalSpreadScenario(mode)

        let rowButton = goalSpreadRow()
        XCTAssertTrue(rowButton.waitForExistence(timeout: 10), file: file, line: line)
        let metadata = app.staticTexts["budgetLineMixedRowMetadata-\(Self.goalSpreadLineId)"]
        XCTAssertTrue(metadata.waitForExistence(timeout: 10), file: file, line: line)
        scrollUntilFullyVisible(
            metadata,
            below: app.navigationBars.firstMatch.frame.maxY,
            above: app.windows.firstMatch.frame.maxY
        )
        XCTAssertTrue(rowButton.isHittable, file: file, line: line)
        attachScreenshot("ios-goal-spread-row-\(mode.name)")

        rowButton.tap()

        let detailRoot = app.descendants(matching: .any)
            .matching(identifier: "budgetLineDetailPageRoot")
            .firstMatch
        XCTAssertTrue(detailRoot.waitForExistence(timeout: 10), file: file, line: line)
        let goal = app.buttons["budgetLineDetailGoalLink"]
        let spread = app.buttons["spreadAffordanceButton"]
        let navigationBar = app.navigationBars.firstMatch
        let primaryAction = app.buttons["budgetLineDetailPrimaryAction"]
        XCTAssertTrue(primaryAction.waitForExistence(timeout: 10), file: file, line: line)
        scrollPairIntoView(
            goal,
            spread,
            below: navigationBar.frame.maxY,
            above: primaryAction.frame.minY
        )
        assertVisible(goal, below: navigationBar, above: primaryAction)
        assertVisible(spread, below: navigationBar, above: primaryAction)
        XCTAssertGreaterThanOrEqual(goal.frame.height, 44, file: file, line: line)
        XCTAssertGreaterThanOrEqual(spread.frame.height, 44, file: file, line: line)
        XCTAssertFalse(goal.frame.intersects(spread.frame), file: file, line: line)
        attachScreenshot("ios-goal-spread-detail-\(mode.name)")

        app.terminate()
    }

    func testGoalAndSpreadMetadataRoutesOpenExpectedDestinations() {
        launchGoalSpreadScenario(DisplayMode(name: "routes", dynamicType: false, darkMode: false))
        let rowButton = goalSpreadRow()
        XCTAssertTrue(rowButton.waitForExistence(timeout: 10))
        scrollUntilHittable(rowButton)
        rowButton.tap()

        let goal = app.buttons["budgetLineDetailGoalLink"]
        scrollUntilHittable(goal)
        goal.tap()
        // The bar takes the goal's own name, which the harness seeds: it says which
        // goal was opened, where the root identifier only says that one was.
        XCTAssertTrue(app.navigationBars[Self.goalName].waitForExistence(timeout: 10))
        XCTAssertTrue(app.scrollViews["savingsGoalDetailRoot"].waitForExistence(timeout: 10))
        XCTAssertTrue(
            app.descendants(matching: .any)["savingsGoalProgressCard"].waitForExistence(timeout: 10)
        )
        XCTAssertFalse(app.descendants(matching: .any)["savingsGoalEmptyGuidanceCard"].exists)
        let linkedPlanMonth = app.descendants(matching: .any)
            .matching(identifier: "savingsGoalPlanMonthRow-\(Self.goalSpreadPlanMonth)")
            .firstMatch
        XCTAssertTrue(linkedPlanMonth.waitForExistence(timeout: 10))
        XCTAssertTrue(
            linkedPlanMonth.label.contains(Self.goalSpreadAmount),
            "Plan month does not carry its amount: \(linkedPlanMonth.label)"
        )
        scrollUntilFullyVisible(
            linkedPlanMonth,
            below: app.navigationBars.firstMatch.frame.maxY,
            above: app.windows.firstMatch.frame.maxY
        )
        XCTAssertFalse(app.descendants(matching: .any)["networkUnavailableRoot"].exists)
        attachScreenshot("ios-goal-spread-goal-destination")

        app.navigationBars.buttons.firstMatch.tap()
        let spread = app.buttons["spreadAffordanceButton"]
        scrollUntilHittable(spread)
        spread.tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["spreadOccurrencesRoot"].waitForExistence(timeout: 10)
        )
        let occurrence = app.descendants(matching: .any)
            .matching(identifier: "spreadOccurrenceRow-\(Self.goalSpreadLineId)")
            .firstMatch
        XCTAssertTrue(occurrence.waitForExistence(timeout: 10))
        scrollUntilFullyVisible(
            occurrence,
            below: app.navigationBars.firstMatch.frame.maxY,
            above: app.windows.firstMatch.frame.maxY
        )
        XCTAssertTrue(occurrence.label.contains(Self.goalSpreadAmount))
        XCTAssertTrue(occurrence.label.contains("CHF"))
        XCTAssertFalse(app.descendants(matching: .any)["networkUnavailableRoot"].exists)
        attachScreenshot("ios-goal-spread-spread-destination")
    }

    private func launchScenario(_ scenario: String) {
        app = XCUIApplication()
        app.launchArguments += [scenario]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        app.launch()
    }

    private func launchGoalSpreadScenario(_ mode: DisplayMode) {
        app = XCUIApplication()
        app.launchArguments = ["-\(Self.goalSpreadScenario)"]
        app.launchEnvironment["UITEST_SCENARIO"] = Self.goalSpreadScenario
        app.launchEnvironment["UITEST_COLOR_SCHEME"] = mode.darkMode ? "dark" : "light"
        if mode.dynamicType {
            app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "accessibility3"
        }
        app.launch()
        let budget = app.buttons["budgetCard-\(Self.goalSpreadBudgetId)"]
        XCTAssertTrue(budget.waitForExistence(timeout: 10))
        budget.tap()
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    private func assertVisible(
        _ element: XCUIElement,
        below topElement: XCUIElement,
        above bottomElement: XCUIElement
    ) {
        let frame = element.frame
        XCTAssertTrue(element.exists)
        XCTAssertTrue(element.isHittable)
        XCTAssertGreaterThanOrEqual(
            frame.minY,
            topElement.frame.maxY,
            "Element \(frame) starts above navigation \(topElement.frame)"
        )
        XCTAssertLessThanOrEqual(
            frame.maxY,
            bottomElement.frame.minY,
            "Element \(frame) ends below primary action \(bottomElement.frame)"
        )
    }

    private func assertFullyVisible(
        _ element: XCUIElement,
        below topY: CGFloat,
        above bottomY: CGFloat
    ) {
        let frame = element.frame
        XCTAssertTrue(element.exists)
        XCTAssertGreaterThanOrEqual(frame.minY, topY)
        XCTAssertLessThanOrEqual(frame.maxY, bottomY)
    }

    private func scrollUntilFullyVisible(
        _ element: XCUIElement,
        below topY: CGFloat,
        above bottomY: CGFloat
    ) {
        for _ in 0..<8 {
            guard element.exists else {
                app.swipeUp()
                continue
            }
            if element.frame.minY >= topY, element.frame.maxY <= bottomY {
                break
            }
            if element.frame.maxY > bottomY {
                app.swipeUp()
            } else {
                app.swipeDown()
            }
        }
        assertFullyVisible(element, below: topY, above: bottomY)
    }

    /// Brings both elements inside the `topY ..< bottomY` window by dragging the
    /// distance that is actually missing, re-measuring after every drag.
    ///
    /// A fixed-distance drag is calibrated against one layout and goes stale the
    /// moment a row changes height — which is precisely what a design change is
    /// allowed to do. Measuring instead of guessing keeps the assertions about
    /// reachability rather than about pixel budgets.
    private func scrollPairIntoView(
        _ first: XCUIElement,
        _ second: XCUIElement,
        below topY: CGFloat,
        above bottomY: CGFloat
    ) {
        let screenHeight = app.windows.firstMatch.frame.height
        guard screenHeight > 0 else { return }

        for _ in 0..<6 {
            let union = first.frame.union(second.frame)
            // Taller than the window: no scroll position satisfies both bounds.
            // Stop and let the assertions report the real problem.
            guard union.height <= bottomY - topY else { return }
            guard union.minY < topY || union.maxY > bottomY else { return }

            // Aim for the middle of the window rather than the offending edge: a
            // drag of the few points that are missing sits under the scroll
            // view's pan threshold and moves nothing at all. Centering is a fixed
            // point, so repeating it converges instead of oscillating.
            let shift = union.midY - (topY + bottomY) / 2
            let fromY: CGFloat = shift > 0 ? 0.75 : 0.25
            dragUp(
                fromY: fromY,
                toY: min(max(fromY - shift / screenHeight, 0.05), 0.95)
            )
        }
    }

    private func dragUp(fromY: CGFloat, toY: CGFloat) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: fromY))
            .press(
                forDuration: 0.1,
                thenDragTo: app.coordinate(
                    withNormalizedOffset: CGVector(dx: 0.5, dy: toY)
                ),
                withVelocity: .slow,
                thenHoldForDuration: 0
            )
    }

    private func goalSpreadRow() -> XCUIElement {
        // The inner button, not the `.contain` row container: tapping the container's
        // frame synthesizes nothing the SwiftUI button receives.
        app.buttons["budgetLineMixedRowButton-\(Self.goalSpreadLineId)"].firstMatch
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// A row carries its identifier on the Button, and `accessibilityElement(children:)`
    /// can republish it on the containing element instead — so both types are tried
    /// rather than assuming which one the tree exposes.
    private func waitForBudgetRow(
        identifier: String,
        timeout: TimeInterval = 10
    ) -> XCUIElement {
        let strategies = [
            app.buttons[identifier].firstMatch,
            app.otherElements[identifier].firstMatch,
        ]

        // First strategy gets the full timeout; the fallback gets 1s.
        for (index, element) in strategies.enumerated() {
            let wait: TimeInterval = index == 0 ? timeout : 1
            if element.waitForExistence(timeout: wait) {
                return element
            }
        }

        XCTFail("Expected row '\(identifier)' to exist. Debug tree:\n\(app.debugDescription)")
        return strategies[0]
    }
}
