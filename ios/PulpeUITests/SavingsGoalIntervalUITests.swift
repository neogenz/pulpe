import XCTest

@MainActor
final class SavingsGoalIntervalUITests: XCTestCase {
    private struct DetailExpectation {
        let scenario: String
        let hasTarget: Bool
        let deadlineMarker: String?
        let hasProjection: Bool
        let hasRequiredAmount: Bool
        let hasEstimation: Bool
        let hasSuggestion: Bool
        let hasTrajectory: Bool
        let canAdjust: Bool
        let hasPace: Bool
    }

    private static let detailExpectations = [
        DetailExpectation(
            scenario: "UITEST_SAVINGS_GOAL_DETAIL_NAME_ONLY",
            hasTarget: false,
            deadlineMarker: nil,
            hasProjection: true,
            hasRequiredAmount: false,
            hasEstimation: false,
            hasSuggestion: false,
            hasTrajectory: false,
            canAdjust: false,
            hasPace: false
        ),
        DetailExpectation(
            scenario: "UITEST_SAVINGS_GOAL_DETAIL_TARGET_ONLY",
            hasTarget: true,
            deadlineMarker: nil,
            hasProjection: true,
            hasRequiredAmount: false,
            hasEstimation: true,
            hasSuggestion: true,
            hasTrajectory: true,
            canAdjust: true,
            hasPace: false
        ),
        DetailExpectation(
            scenario: "UITEST_SAVINGS_GOAL_DETAIL_DEADLINE_ONLY",
            hasTarget: false,
            deadlineMarker: "Échéance",
            hasProjection: true,
            hasRequiredAmount: false,
            hasEstimation: false,
            hasSuggestion: false,
            hasTrajectory: false,
            canAdjust: false,
            hasPace: false
        ),
        DetailExpectation(
            scenario: "UITEST_SAVINGS_GOAL_DETAIL_FULL",
            hasTarget: true,
            deadlineMarker: "→",
            hasProjection: true,
            hasRequiredAmount: true,
            hasEstimation: true,
            hasSuggestion: false,
            hasTrajectory: true,
            canAdjust: true,
            hasPace: true
        ),
    ]

    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
    }

    func testNameOnlyGoalCanBeCreated() {
        launch("UITEST_SAVINGS_GOAL_FORM")

        let name = app.textFields["Nom de l'objectif d'épargne"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Coussin de sécurité")
        app.buttons["Fermer le clavier"].tap()

        let create = app.buttons["Créer l'objectif"]
        XCTAssertTrue(create.isEnabled)
        create.tap()

        assertProbe("savingsGoalUITestCreateCount", equals: "1")
        assertProbe("savingsGoalUITestLastGoalName", equals: "Coussin de sécurité")
        attachScreenshot("ios-form-name-only")
    }

    func testInvalidIntervalCannotBeSaved() {
        launch("UITEST_SAVINGS_GOAL_FORM_INVALID_INTERVAL")

        let save = app.buttons["Enregistrer"]
        XCTAssertTrue(save.waitForExistence(timeout: 10))
        XCTAssertFalse(save.isEnabled)
        assertProbe("savingsGoalUITestUpdateCount", equals: "0")
        attachScreenshot("ios-form-invalid-interval")
    }

    func testFourDetailStatesRenderOnlyApplicableRegions() {
        for expectation in Self.detailExpectations {
            launch(expectation.scenario)
            XCTAssertTrue(app.scrollViews["savingsGoalDetailRoot"].waitForExistence(timeout: 10))
            XCTAssertEqual(element(labelContaining: "% de la cible épargné").exists, expectation.hasTarget)
            if let deadlineMarker = expectation.deadlineMarker {
                XCTAssertTrue(element(labelContaining: deadlineMarker).exists)
            } else {
                XCTAssertFalse(element(labelContaining: "Échéance").exists)
                XCTAssertFalse(element(labelContaining: "→").exists)
            }
            XCTAssertEqual(app.staticTexts["Projection du plan"].exists, expectation.hasProjection)
            XCTAssertEqual(
                app.staticTexts["Pour tenir ton échéance"].exists,
                expectation.hasRequiredAmount
            )
            XCTAssertEqual(app.staticTexts["Atteinte estimée"].exists, expectation.hasEstimation)
            XCTAssertEqual(app.staticTexts["Objectif atteint"].exists, expectation.hasSuggestion)
            XCTAssertEqual(app.staticTexts["Ta trajectoire"].exists, expectation.hasTrajectory)
            XCTAssertEqual(app.buttons["Ajuster le plan"].exists, expectation.canAdjust)
            XCTAssertEqual(element(labelContaining: "Rythme :").exists, expectation.hasPace)
            attachScreenshot("\(expectation.scenario.lowercased())-light-large")
            app.terminate()
        }
    }

    func testAccessibilityDynamicTypeKeepsFormAndDetailActionable() {
        launch("UITEST_SAVINGS_GOAL_FORM", dynamicType: true)

        let name = app.textFields["Nom de l'objectif d'épargne"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Projet accessible")
        app.buttons["Fermer le clavier"].tap()

        let create = app.buttons["Créer l'objectif"]
        scrollUntilHittable(create)
        attachScreenshot("ios-form-light-accessibility3")
        create.tap()
        assertProbe("savingsGoalUITestCreateCount", equals: "1")

        app.terminate()
        launch("UITEST_SAVINGS_GOAL_DETAIL_FULL", dynamicType: true)

        let adjust = app.buttons["Ajuster le plan"]
        XCTAssertTrue(adjust.waitForExistence(timeout: 10))
        scrollUntilHittable(adjust)
        attachScreenshot("ios-detail-full-light-accessibility3")
        adjust.tap()
        XCTAssertTrue(app.scrollViews["goalPlanSimulatorRoot"].waitForExistence(timeout: 10))
    }

    func testDeadlineReconciliationCancelWritesNothing() {
        openDeadlineReconciliation(darkMode: true)

        XCTAssertTrue(app.buttons["Garder sans objectif"].exists)
        XCTAssertTrue(app.buttons["Supprimer les prévisions"].exists)
        attachScreenshot("ios-deadline-confirmation-dark-large")
        app.buttons["Ne rien changer"].tap()

        assertProbe("savingsGoalUITestUpdateCount", equals: "0")
    }

    func testDeadlineReconciliationFreezeWritesOnce() {
        openDeadlineReconciliation()

        app.buttons["Garder sans objectif"].tap()

        assertProbe("savingsGoalUITestUpdateCount", equals: "1")
        assertProbe("savingsGoalUITestReconciliationMode", equals: "freeze")
        attachScreenshot("ios-deadline-freeze-light-large")
    }

    func testDeadlineReconciliationRemoveWritesOnce() {
        openDeadlineReconciliation()

        app.buttons["Supprimer les prévisions"].tap()

        assertProbe("savingsGoalUITestUpdateCount", equals: "1")
        assertProbe("savingsGoalUITestReconciliationMode", equals: "remove")
        attachScreenshot("ios-deadline-remove-light-large")
    }

    func testTemplateLineShowsGoalChipOnlyWhenLinked() {
        launch("UITEST_SAVINGS_GOAL_TEMPLATE_LINES")

        XCTAssertTrue(app.staticTexts["Épargne voyage"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Objectif : Voyage au Japon"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Épargne libre"].exists)
        XCTAssertEqual(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Objectif :")).count, 1)
        attachScreenshot("ios-template-linked-goal-light-large")
    }

    private func openDeadlineReconciliation(darkMode: Bool = false) {
        launch("UITEST_SAVINGS_GOAL_DEADLINE_RECONCILIATION", darkMode: darkMode)

        let edit = app.buttons["Modifier l'objectif"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()

        let closeKeyboard = app.buttons["Fermer le clavier"]
        if closeKeyboard.waitForExistence(timeout: 2) {
            closeKeyboard.tap()
        }

        let deadline = app.datePickers["savingsGoalTargetDatePicker"]
        XCTAssertTrue(deadline.waitForExistence(timeout: 5))
        deadline.tap()

        let previousMonth = app.buttons["DatePicker.PreviousMonth"]
        XCTAssertTrue(
            previousMonth.waitForExistence(timeout: 3),
            "Expected the compact date picker previous-month control. Tree:\n\(app.debugDescription)"
        )
        previousMonth.tap()

        let day = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "15 juillet")).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 3))
        day.tap()

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.2)).tap()
        app.buttons["Enregistrer"].tap()
        XCTAssertTrue(app.navigationBars["Échéance avancée"].waitForExistence(timeout: 10))
    }

    private func launch(
        _ scenario: String,
        dynamicType: Bool = false,
        darkMode: Bool = false
    ) {
        app = XCUIApplication()
        app.launchArguments = ["-\(scenario)"]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        if dynamicType {
            app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "accessibility3"
        }
        if darkMode {
            app.launchEnvironment["UITEST_COLOR_SCHEME"] = "dark"
        }
        app.launch()
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    private func assertProbe(
        _ identifier: String,
        equals expectedValue: String,
        timeout: TimeInterval = 10
    ) {
        let probe = app.staticTexts[identifier]
        XCTAssertTrue(probe.waitForExistence(timeout: timeout), "Missing probe \(identifier)")
        let predicate = NSPredicate(format: "label == %@", expectedValue)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: probe)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed)
    }

    private func element(
        labelContaining fragment: String,
        type: XCUIElement.ElementType = .any
    ) -> XCUIElement {
        app.descendants(matching: type)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", fragment))
            .firstMatch
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
