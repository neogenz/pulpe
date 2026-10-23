import XCTest

@MainActor
final class IPhoneDuoContinuityUITests: XCTestCase {
    private var app = XCUIApplication()

    @MainActor
    override func tearDown() async throws {
        if let testRun, !testRun.hasSucceeded { capture("failure") }
        app.terminate()
        XCUIDevice.shared.orientation = .portrait
        try await super.tearDown()
    }

    func testNativeBaselineAcrossOrientations() {
        continueAfterFailure = false
        launch("UITEST_CONTEXTUAL_CREATION_HOME")
        captureBothOrientations("home", landmark: app.descendants(matching: .any)["home-balance-chart"])
        app.terminate()

        // A fresh process and the unseeded detail cache exercise the cold list-to-detail route.
        launch("UITEST_BUDGET_GOAL_SPREAD_METADATA")
        let month = app.buttons["budgetMonthRow-goal-spread-budget"]
        captureBothOrientations("annual-budget", landmark: month)
        scrollUntilHittable(month)
        month.tap()
        captureBothOrientations("budget-detail", landmark: app.staticTexts["budgetDetailHeroAmount"])

        let addForecast = app.buttons["budgetAddLineButton"]
        scrollUntilHittable(addForecast)
        addForecast.tap()
        let submit = app.buttons["addBudgetLineSubmit"].firstMatch
        XCTAssertTrue(submit.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        app.typeText("12")
        captureBothOrientations("entry-draft", landmark: app.staticTexts["12"], expectsKeyboard: true)
        XCTAssertFalse(submit.isEnabled, "An amount without a description must remain an unfinished draft.")
    }

    private func launch(_ scenario: String) {
        XCUIDevice.shared.orientation = .portrait
        app = XCUIApplication()
        app.launchArguments = ["-\(scenario)", "-AppleLanguages", "(fr)"]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "large"
        app.launchEnvironment["UITEST_COLOR_SCHEME"] = "light"
        app.launch()
    }

    private func captureBothOrientations(
        _ screen: String,
        landmark: XCUIElement,
        expectsKeyboard: Bool = false
    ) {
        // These are real rotations, not assertions about the active Duo display or fold angle.
        for orientation in [UIDeviceOrientation.portrait, .landscapeLeft] {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(landmark.waitForExistence(timeout: 15), app.debugDescription)
            let geometry = NSPredicate { _, _ in
                let frame = self.app.windows.firstMatch.frame
                return orientation.isLandscape ? frame.width > frame.height : frame.height > frame.width
            }
            let rotation = XCTNSPredicateExpectation(predicate: geometry, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [rotation], timeout: 10), .completed, app.debugDescription)
            if expectsKeyboard {
                XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), app.debugDescription)
            }
            let suffix = orientation.isLandscape ? "landscape-left" : "portrait"
            capture("\(screen)-\(suffix)")
        }
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "native-baseline-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), app.debugDescription)
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }
}
