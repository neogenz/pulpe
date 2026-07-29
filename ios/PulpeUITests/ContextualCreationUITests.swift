import XCTest

@MainActor
final class ContextualCreationUITests: XCTestCase {
    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testHomeCreationActionRemainsAccessibleAtLargeText() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME")

        let addOperation = app.buttons["Ajouter une opération"]
        XCTAssertTrue(addOperation.waitForExistence(timeout: 10), app.debugDescription)
        scrollUntilHittable(addOperation)
        assertMinimumHitArea(addOperation)
        attachScreenshot("contextual-creation-home-accessibility3")

        addOperation.tap()
        XCTAssertTrue(app.buttons["Ajouter"].firstMatch.waitForExistence(timeout: 5))
    }

    func testBudgetToolbarActionsRemainDistinctAtLargeText() {
        launch("UITEST_CONTEXTUAL_CREATION_BUDGET")

        let tracking = app.buttons["Suivi du budget"]
        let addForecast = app.buttons["Ajouter une prévision"]
        XCTAssertTrue(tracking.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(addForecast.waitForExistence(timeout: 10), app.debugDescription)
        attachScreenshot("contextual-creation-budget-accessibility3")
        assertMinimumHitArea(tracking)
        assertMinimumHitArea(addForecast)
        XCTAssertFalse(tracking.frame.intersects(addForecast.frame))

        addForecast.tap()
        XCTAssertTrue(app.buttons["Ajouter"].firstMatch.waitForExistence(timeout: 5))
    }

    private func launch(_ scenario: String) {
        app = XCUIApplication()
        app.launchArguments = ["-\(scenario)"]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "accessibility3"
        app.launch()
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    private func assertMinimumHitArea(_ element: XCUIElement) {
        let hittable = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "hittable == true"),
            object: element
        )
        XCTAssertEqual(XCTWaiter.wait(for: [hittable], timeout: 5), .completed, app.debugDescription)
        XCTAssertGreaterThanOrEqual(element.frame.width, 44)
        XCTAssertGreaterThanOrEqual(element.frame.height, 44)
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
