import XCTest

@MainActor
final class IPhoneDuoContinuityUITests: XCTestCase {
    private var app = XCUIApplication()

    @MainActor
    override func tearDown() async throws {
        if let testRun, testRun.totalFailureCount > 0 { capture("failure") }
        app.terminate()
        XCUIDevice.shared.orientation = .portrait
        try await super.tearDown()
    }

    func testNativeBaselineAcrossOrientations() {
        continueAfterFailure = false
        launch("UITEST_CONTEXTUAL_CREATION_HOME")
        captureOrientations("home", landmark: app.descendants(matching: .any)["home-balance-chart"])
        app.terminate()

        // A fresh process and the unseeded detail cache exercise the cold list-to-detail route.
        launch("UITEST_BUDGET_GOAL_SPREAD_METADATA")
        XCTAssertTrue(app.tabBars.buttons["Budgets"].waitForExistence(timeout: 10), app.debugDescription)
        let month = app.buttons["budgetMonthRow-goal-spread-budget"]
        captureOrientations("annual-budget", landmark: month)
        verifySidebarDrafts()
        scrollUntilHittable(month)
        month.tap()
        captureOrientations("budget-detail", landmark: app.staticTexts["budgetDetailHeroAmount"])
        verifyMonthSelectionRoundTrip(originalMonth: month)

        let addForecast = app.buttons["budgetAddLineButton"]
        scrollUntilHittable(addForecast)
        addForecast.tap()
        let submit = app.buttons["addBudgetLineSubmit"].firstMatch
        XCTAssertTrue(submit.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        for digit in ["1", "2"] {
            let key = app.keyboards.keys[digit]
            XCTAssertTrue(key.waitForExistence(timeout: 5), app.debugDescription)
            key.tap()
        }
        let amount = app.buttons.matching(NSPredicate(format: "label == %@ AND value == %@", "Montant", "12 CHF"))
            .firstMatch
        captureOrientations("entry-draft", landmark: amount, expectsKeyboard: true)
        XCTAssertFalse(submit.isEnabled, "An amount without a description must remain an unfinished draft.")
        app.buttons["Champ suivant"].tap()
        XCTAssertTrue(app.textFields["Description de la prévision"].waitForExistence(timeout: 5))
        let letter = app.keyboards.keys.matching(NSPredicate(format: "label ==[c] %@", "a")).firstMatch
        XCTAssertTrue(letter.waitForExistence(timeout: 5), app.debugDescription)
        let description = app.textFields["Description de la prévision"]
        description.typeText("Repas test")
        XCTAssertEqual(description.value as? String, "Repas test")
        app.buttons["Champ précédent"].tap()
        XCTAssertTrue(app.keyboards.keys["1"].waitForExistence(timeout: 5), app.debugDescription)
        captureOrientations(
            "entry-draft-restored", landmark: amount, expectsKeyboard: true, preservingDescription: "Repas test"
        )
        app.buttons["keyboardDismissButton"].tap()
        scrollUntilHittable(submit)
        XCTAssertTrue(app.windows.firstMatch.frame.contains(submit.frame), app.debugDescription)
        XCTAssertTrue(submit.isEnabled, "The complete draft must be ready without submitting it.")
        capture("entry-draft-submit")
    }

    private func verifySidebarDrafts() {
        for (action, title) in [("Créer un nouveau budget", "Nouveau budget"),
                                ("Planifier plusieurs budgets", "Planifier des budgets")] {
            app.buttons[action].tap()
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 10), app.debugDescription)
            let template = app.buttons["Mois vacances"]
            scrollUntilHittable(template)
            template.tap()
            captureOrientations(title, landmark: template, preservingSelection: true)
            app.navigationBars[title].buttons["Fermer"].tap()
            XCTAssertTrue(app.navigationBars[title].waitForNonExistence(timeout: 5))
        }
    }

    private func verifyMonthSelectionRoundTrip(originalMonth: XCUIElement) {
        returnToMonthList()
        XCTAssertTrue(originalMonth.waitForExistence(timeout: 5), app.debugDescription)
        let year = app.buttons["budgetYearPicker"]
        year.tap()
        app.buttons["2027"].tap()
        let nextYear = app.buttons["budgetMonthRow-duo-next-year-budget"]
        XCTAssertTrue(nextYear.waitForExistence(timeout: 5), app.debugDescription)
        nextYear.tap()
        XCTAssertTrue(app.navigationBars["Janvier 2027"].waitForExistence(timeout: 10), app.debugDescription)
        captureOrientations("next-year-budget", landmark: app.staticTexts["budgetDetailHeroAmount"])
        returnToMonthList()
        XCTAssertTrue(nextYear.waitForExistence(timeout: 5), "Returning must keep the selected year.")
        year.tap()
        app.buttons["2026"].tap()
        captureOrientations("previous-year-restored", landmark: originalMonth)
        originalMonth.tap()
        XCTAssertTrue(app.navigationBars["Août 2026"].waitForExistence(timeout: 10), app.debugDescription)
    }

    private func returnToMonthList() {
        XCUIDevice.shared.orientation = .portrait
        let back = app.buttons["BackButton"]
        let compact = NSPredicate { _, _ in
            let frame = self.app.windows.firstMatch.frame
            return frame.height > frame.width && back.exists && back.isHittable
        }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: compact, object: nil)], timeout: 10),
                       .completed, app.debugDescription)
        back.tap()
        XCTAssertTrue(app.buttons["budgetYearPicker"].waitForExistence(timeout: 5), app.debugDescription)
    }

    private func launch(_ scenario: String) {
        XCUIDevice.shared.orientation = .portrait
        app = XCUIApplication()
        app.launchArguments = ["-\(scenario)", "-AppleLanguages", "(fr)"]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "large"
        app.launchEnvironment["UITEST_NATIVE_NAVIGATION"] = "1"
        app.launchEnvironment["UITEST_COLOR_SCHEME"] = "light"
        app.launch()
    }

    private func captureOrientations(
        _ screen: String,
        landmark: XCUIElement,
        expectsKeyboard: Bool = false,
        preservingDescription: String? = nil,
        preservingSelection: Bool = false
    ) {
        // These are real rotations, not assertions about the active Duo display or fold angle.
        for orientation in [UIDeviceOrientation.portrait, .landscapeLeft, .landscapeRight] {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(landmark.waitForExistence(timeout: 15), app.debugDescription)
            var previousContentFrame: CGRect?
            let geometry = NSPredicate { _, _ in
                let frame = self.app.windows.firstMatch.frame
                let contentFrame = landmark.frame
                defer { previousContentFrame = contentFrame }
                let rotated = orientation.isLandscape ? frame.width > frame.height : frame.height > frame.width
                let keyboard = self.app.keyboards.firstMatch
                let coveredByBar = self.app.navigationBars.allElementsBoundByIndex.contains {
                    $0.isHittable && $0.frame.intersects(contentFrame)
                }
                let aboveKeyboard = !expectsKeyboard || (keyboard.exists && frame.contains(contentFrame)
                    && !keyboard.frame.intersects(contentFrame) && !coveredByBar)
                return rotated && !contentFrame.isEmpty && frame.intersects(contentFrame)
                    && contentFrame == previousContentFrame && aboveKeyboard
            }
            let rotation = XCTNSPredicateExpectation(predicate: geometry, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [rotation], timeout: 10), .completed, app.debugDescription)
            if expectsKeyboard {
                XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), app.debugDescription)
            }
            if preservingSelection { XCTAssertTrue(landmark.isSelected, app.debugDescription) }
            if let preservingDescription {
                XCTAssertEqual(app.textFields["Description de la prévision"].value as? String, preservingDescription)
            }
            let suffix = orientation == .portrait ? "portrait"
                : (orientation == .landscapeLeft ? "landscape-left" : "landscape-right")
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
        for _ in 0..<8 {
            let frame = element.frame
            if !frame.isEmpty && app.windows.firstMatch.frame.contains(frame) && element.isHittable { break }
            let identifier = element.identifier.isEmpty ? element.label : element.identifier
            let scroll = app.scrollViews.containing(.button, identifier: identifier).firstMatch
            if scroll.exists { scroll.swipeUp() } else { app.swipeUp() }
        }
        var previousFrame: CGRect?
        let visible = NSPredicate { _, _ in
            let frame = element.frame
            defer { previousFrame = frame }
            return !frame.isEmpty && self.app.windows.firstMatch.frame.contains(frame)
                && element.isHittable && frame == previousFrame
        }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: visible, object: nil)], timeout: 5),
                       .completed, app.debugDescription)
    }
}
