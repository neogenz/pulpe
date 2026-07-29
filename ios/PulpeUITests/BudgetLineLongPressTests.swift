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
    private static let goalName = "Voyage au Japon"

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

    func testGoalAndSpreadMetadataRemainUsableAcrossAccessibilityMatrix() {
        let displayModes = [
            DisplayMode(name: "light-large", dynamicType: false, darkMode: false),
            DisplayMode(name: "dark-large", dynamicType: false, darkMode: true),
            DisplayMode(name: "light-accessibility3", dynamicType: true, darkMode: false),
            DisplayMode(name: "dark-accessibility3", dynamicType: true, darkMode: true),
        ]

        for mode in displayModes {
            launchGoalSpreadScenario(mode)

            let row = app.otherElements["budgetLineMixedRow-\(Self.goalSpreadLineId)"]
            XCTAssertTrue(row.waitForExistence(timeout: 10))
            let rowButton = goalSpreadRowButton()
            scrollUntilHittable(rowButton)
            XCTAssertTrue(row.label.contains("Lissé · objectif \(Self.goalName)"))
            attachScreenshot("ios-goal-spread-row-\(mode.name)")

            rowButton.tap()

            let detailRoot = app.descendants(matching: .any)
                .matching(identifier: "budgetLineDetailPageRoot")
                .firstMatch
            XCTAssertTrue(detailRoot.waitForExistence(timeout: 10))
            let goal = app.buttons["Objectif d'épargne : \(Self.goalName)"]
            let spread = app.buttons["Épargne lissée, voir les mois"]
            scrollUntilHittable(goal)
            scrollUntilHittable(spread)
            XCTAssertGreaterThanOrEqual(goal.frame.height, 44)
            XCTAssertGreaterThanOrEqual(spread.frame.height, 44)
            XCTAssertFalse(goal.frame.intersects(spread.frame))
            if mode.dynamicType {
                dragUp(fromY: 0.60, toY: 0.40)
                attachScreenshot("ios-goal-spread-detail-goal-\(mode.name)")
                dragUp(fromY: 0.60, toY: 0.40)
                attachScreenshot("ios-goal-spread-detail-spread-\(mode.name)")
            } else {
                attachScreenshot("ios-goal-spread-detail-\(mode.name)")
            }

            app.terminate()
        }
    }

    func testGoalAndSpreadMetadataRoutesOpenExpectedDestinations() {
        launchGoalSpreadScenario(DisplayMode(name: "routes", dynamicType: false, darkMode: false))
        let row = app.otherElements["budgetLineMixedRow-\(Self.goalSpreadLineId)"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        let rowButton = goalSpreadRowButton()
        scrollUntilHittable(rowButton)
        rowButton.tap()

        let goal = app.buttons["Objectif d'épargne : \(Self.goalName)"]
        scrollUntilHittable(goal)
        goal.tap()
        XCTAssertTrue(app.navigationBars[Self.goalName].waitForExistence(timeout: 10))

        app.navigationBars.buttons.firstMatch.tap()
        let spread = app.buttons["Épargne lissée, voir les mois"]
        scrollUntilHittable(spread)
        spread.tap()
        XCTAssertTrue(app.navigationBars["Dépense lissée"].waitForExistence(timeout: 10))
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
        if mode.dynamicType {
            app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "accessibility3"
        }
        if mode.darkMode {
            app.launchEnvironment["UITEST_COLOR_SCHEME"] = "dark"
        }
        app.launch()
        let budget = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Août,"))
            .firstMatch
        XCTAssertTrue(budget.waitForExistence(timeout: 10))
        budget.tap()
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    private func goalSpreadRowButton() -> XCUIElement {
        app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Épargne, \(Self.goalName)"))
            .firstMatch
    }

    private func dragUp(fromY: CGFloat, toY: CGFloat) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: fromY))
            .press(
                forDuration: 0.05,
                thenDragTo: app.coordinate(
                    withNormalizedOffset: CGVector(dx: 0.5, dy: toY)
                )
            )
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func waitForBudgetRow(
        primaryIdentifier: String,
        fallbackLabel: String,
        timeout: TimeInterval = 10
    ) -> XCUIElement {
        let strategies: [(String, XCUIElement)] = [
            ("buttons[\(primaryIdentifier)]", app.buttons[primaryIdentifier].firstMatch),
            ("otherElements[\(primaryIdentifier)]", app.otherElements[primaryIdentifier].firstMatch),
            ("buttons[\(fallbackLabel)]", app.buttons[fallbackLabel].firstMatch),
            ("staticTexts[\(fallbackLabel)]", app.staticTexts[fallbackLabel].firstMatch),
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
