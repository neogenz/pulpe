import XCTest

@MainActor
final class IPhoneDuoContinuityUITests: XCTestCase {
    private var app = XCUIApplication()
    private var orientations: [UIDeviceOrientation] = []

    @MainActor
    override func tearDown() async throws {
        if let testRun, testRun.totalFailureCount > 0 { capture("failure") }
        app.terminate()
        XCUIDevice.shared.orientation = .portrait
        try await super.tearDown()
    }

    func testNativeBaselineAcrossOrientations() {
        orientations = [.portrait, .landscapeLeft, .landscapeRight]
        verifyNativeBudgetJourney()
    }

    func testNativeBudgetJourneyOnCurrentGeometry() {
        orientations = [.portrait]
        verifyNativeBudgetJourney()
        let coverage = XCTAttachment(string: "Current geometry only: rotations and fold transitions are not validated.")
        coverage.name = "current-geometry-coverage"
        coverage.lifetime = .keepAlways
        add(coverage)
    }

    private func verifyNativeBudgetJourney() {
        continueAfterFailure = false
        launch("UITEST_CONTEXTUAL_CREATION_HOME")
        captureOrientations(
            "home", landmark: app.descendants(matching: .any)["home-balance-chart"], expandsInLandscape: true
        )
        captureOrientations(
            "home-pending-items", landmark: app.staticTexts["homeUncheckedOperationRow"].firstMatch,
            revealUsing: app.buttons["homeHeroUnchecked"].staticTexts.firstMatch
        )
        app.terminate()

        // A fresh process and the unseeded detail cache exercise the cold list-to-detail route.
        launch("UITEST_BUDGET_GOAL_SPREAD_METADATA")
        XCTAssertTrue(app.buttons["Budgets"].waitForExistence(timeout: 10), app.debugDescription)
        let month = app.buttons["budgetMonthRow-goal-spread-budget"]
        captureOrientations("annual-budget", landmark: month)
        verifySidebarDrafts()
        scrollUntilHittable(month)
        month.tap()
        captureOrientations("budget-detail", landmark: app.staticTexts["budgetDetailHeroAmount"])
        captureOrientations(
            "budget-detail-scrolled", landmark: app.staticTexts["budgetLineMixedRowMetadata-goal-spread-line"],
            afterScroll: true
        )
        verifyLinkedGoal()
        verifyMonthSelectionRoundTrip(originalMonth: month)
        verifyEntryDraft()
    }

    private func verifyEntryDraft() {
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

    private func verifyLinkedGoal() {
        let openingText = app.staticTexts["budgetLineMixedRowMetadata-goal-spread-line"]
        scrollUntilHittable(openingText)
        openingText.tap()
        XCTAssertTrue(app.descendants(matching: .any)["budgetLineDetailPageRoot"].waitForExistence(timeout: 10))
        let goal = app.buttons["budgetLineDetailGoalLink"]
        scrollUntilHittable(goal)
        goal.tap()
        XCTAssertTrue(app.scrollViews["savingsGoalDetailRoot"].waitForExistence(timeout: 10), app.debugDescription)
        captureOrientations(
            "savings-goal", landmark: app.descendants(matching: .any)["savingsGoalProgressCard"].firstMatch
        )
        let edit = app.buttons["savingsGoalEditButton"]
        XCTAssertTrue(edit.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(!edit.frame.isEmpty && app.windows.firstMatch.frame.contains(edit.frame) && edit.isHittable)
        for _ in 0..<2 {
            let back = app.buttons["BackButton"].firstMatch
            XCTAssertTrue(back.waitForExistence(timeout: 5), app.debugDescription)
            back.tap()
        }
        XCTAssertTrue(app.buttons["budgetAddLineButton"].waitForExistence(timeout: 10), app.debugDescription)
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
            let close = app.buttons["Fermer"].firstMatch
            XCTAssertTrue(close.waitForExistence(timeout: 5), app.debugDescription)
            XCTAssertTrue(close.isHittable, app.debugDescription)
            close.tap()
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
        let backAvailable = NSPredicate { _, _ in
            back.exists && !back.frame.isEmpty && back.isHittable
        }
        let backReady = XCTNSPredicateExpectation(predicate: backAvailable, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [backReady], timeout: 10), .completed, app.debugDescription)
        back.tap()
        XCTAssertTrue(app.buttons["budgetYearPicker"].waitForExistence(timeout: 5), app.debugDescription)
    }

    private func launch(_ scenario: String) {
        XCUIDevice.shared.orientation = .portrait
        app = XCUIApplication()
        app.launchArguments = ["-\(scenario)", "-AppleLanguages", "(fr)", "-AppleLocale", "fr_CH"]
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
        preservingSelection: Bool = false,
        expandsInLandscape: Bool = false,
        afterScroll: Bool = false,
        revealUsing: XCUIElement? = nil
    ) {
        var portraitWidth: CGFloat = 0
        // These are real rotations, not assertions about the active Duo display or fold angle.
        for orientation in orientations {
            XCUIDevice.shared.orientation = orientation
            prepareCapture(landmark: landmark, afterScroll: afterScroll, revealUsing: revealUsing)
            var previousContentFrame: CGRect?
            var geometryDetails = ""
            let geometry = NSPredicate { _, _ in
                let frame = self.app.windows.firstMatch.frame
                let contentFrame = landmark.frame
                defer { previousContentFrame = contentFrame }
                let rotated = self.orientations.count == 1
                    || (orientation.isLandscape ? frame.width > frame.height : frame.height > frame.width)
                let stable = contentFrame == previousContentFrame
                let entry = expectsKeyboard && rotated && stable ? self.entryGeometry(for: landmark) : nil
                let keyboardFrame = entry?.keyboard
                let aboveKeyboard = !expectsKeyboard || (entry.map { entry in
                    frame.contains(contentFrame) && !entry.keyboard.intersects(contentFrame) && entry.overlaps.isEmpty
                } ?? false)
                geometryDetails = "window=\(frame) field=\(contentFrame) keyboard=\(String(describing: keyboardFrame))"
                    + " overlappingControls=\(String(describing: entry?.overlaps))"
                    + " rotated=\(rotated) aboveKeyboard=\(aboveKeyboard)"
                return rotated && !contentFrame.isEmpty && frame.intersects(contentFrame)
                    && contentFrame == previousContentFrame && aboveKeyboard
            }
            let rotation = XCTNSPredicateExpectation(predicate: geometry, object: nil)
            let result = XCTWaiter.wait(for: [rotation], timeout: 10)
            if result != .completed {
                capture("geometry-failure-\(screen)", diagnostic: geometryDetails)
            }
            XCTAssertEqual(result, .completed, app.debugDescription)
            if orientation == .portrait {
                portraitWidth = landmark.frame.width
            } else if expandsInLandscape {
                XCTAssertGreaterThan(landmark.frame.width, portraitWidth, "The chart must use the wider viewport.")
            }
            if expandsInLandscape {
                XCTAssertGreaterThanOrEqual(landmark.frame.minX, app.windows.firstMatch.frame.minX)
                XCTAssertLessThanOrEqual(landmark.frame.maxX, app.windows.firstMatch.frame.maxX)
            }
            if expectsKeyboard {
                XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), app.debugDescription)
            }
            if preservingSelection { XCTAssertTrue(landmark.isSelected, app.debugDescription) }
            if let preservingDescription {
                XCTAssertEqual(app.textFields["Description de la prévision"].value as? String, preservingDescription)
            }
            let suffix = orientations.count == 1 ? "current-geometry" : (orientation == .portrait ? "portrait"
                : (orientation == .landscapeLeft ? "landscape-left" : "landscape-right"))
            capture("\(screen)-\(suffix)")
        }
    }

    private func prepareCapture(landmark: XCUIElement, afterScroll: Bool, revealUsing: XCUIElement?) {
        XCTAssertTrue(landmark.waitForExistence(timeout: 15), app.debugDescription)
        if let revealUsing, !app.windows.firstMatch.frame.contains(landmark.frame) || !landmark.isHittable {
            XCTAssertTrue(revealUsing.waitForExistence(timeout: 5), app.debugDescription)
            revealUsing.tap()
        }
        guard afterScroll || revealUsing != nil else { return }
        if afterScroll { scrollUp(towards: landmark) }
        scrollUntilHittable(landmark)
    }

    private func capture(_ name: String, diagnostic: String? = nil) {
        if let diagnostic {
            let details = XCTAttachment(string: diagnostic)
            details.name = name
            details.lifetime = .keepAlways
            add(details)
        }
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "native-baseline-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func scrollUp(towards element: XCUIElement) {
        let identifier = element.identifier.isEmpty ? element.label : element.identifier
        let scroll = app.scrollViews.containing(.any, identifier: identifier).firstMatch
        XCTAssertTrue(scroll.waitForExistence(timeout: 5), app.debugDescription)
        var viewport = scroll.frame.intersection(app.windows.firstMatch.frame)
        for bar in [app.navigationBars.firstMatch, app.tabBars.firstMatch] where bar.exists {
            let frame = bar.frame
            guard frame.width > frame.height, frame.intersects(viewport) else { continue }
            if frame.midY < viewport.midY {
                viewport = CGRect(x: viewport.minX, y: frame.maxY, width: viewport.width,
                                  height: viewport.maxY - frame.maxY)
            } else {
                viewport.size.height = frame.minY - viewport.minY
            }
        }
        XCTAssertFalse(viewport.isEmpty, app.debugDescription)
        let origin = scroll.coordinate(withNormalizedOffset: .zero)
        let xOffset = viewport.midX - scroll.frame.minX
        let yOffset = viewport.minY - scroll.frame.minY
        let start = origin.withOffset(CGVector(dx: xOffset, dy: yOffset + viewport.height * 0.75))
        let end = origin.withOffset(CGVector(dx: xOffset, dy: yOffset + viewport.height * 0.25))
        start.press(forDuration: 0.01, thenDragTo: end)
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), app.debugDescription)
        for _ in 0..<8 {
            let frame = element.frame
            if !frame.isEmpty && app.windows.firstMatch.frame.contains(frame) && element.isHittable { break }
            scrollUp(towards: element)
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

private extension IPhoneDuoContinuityUITests {
    func entryGeometry(for amount: XCUIElement) -> (keyboard: CGRect, overlaps: [CGRect])? {
        // The keyboard lives in another window: XCUIElement normalizes its frame after rotation.
        let keyboard = app.keyboards.firstMatch
        guard keyboard.exists else { return nil }
        let keyboardFrame = keyboard.frame
        guard let amount = try? amount.snapshot() else { return nil }
        let bar = app.navigationBars["Prévoir une dépense"]
        let required = [app.buttons["Fermer"], bar.staticTexts["Prévoir une dépense"],
                        app.buttons["Champ précédent"], app.buttons["Champ suivant"],
                        app.buttons["keyboardDismissButton"]]
        let controls = required.compactMap { try? $0.snapshot() }
        let display = amount.children.filter {
            $0.elementType == .textField || ($0.elementType == .staticText && ["CHF", "12"].contains($0.label))
        }
        let frames = [keyboardFrame] + (controls + display).map(\.frame)
        guard controls.count == required.count,
              display.contains(where: { $0.elementType == .textField }),
              display.contains(where: { $0.label == "CHF" }), display.contains(where: { $0.label == "12" }),
              frames.allSatisfy({ !$0.isEmpty && [$0.minX, $0.minY, $0.width, $0.height].allSatisfy(\.isFinite) })
        else { return nil }
        let overlaps = controls.map(\.frame).filter { control in display.contains { control.intersects($0.frame) } }
        return (keyboardFrame, overlaps)
    }
}
