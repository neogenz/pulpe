import XCTest

@MainActor
final class SavingsGoalIntervalUITests: XCTestCase {
    /// Fixture identifiers seeded by `SavingsGoalIntervalUITestHarness`.
    private static let linkedTemplateLineId = "linked-line"
    private static let freeTemplateLineId = "free-line"

    private struct DetailExpectation {
        let scenario: String
        let hasTarget: Bool
        /// Identifier of the header variant expected for this scenario, `nil` when
        /// the goal has no dates at all.
        let deadlineIdentifier: String?
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
            deadlineIdentifier: nil,
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
            deadlineIdentifier: nil,
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
            deadlineIdentifier: "savingsGoalDeadlineDate",
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
            deadlineIdentifier: "savingsGoalDeadlineRange",
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

        let name = app.textFields["savingsGoalNameField"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Coussin de sécurité")
        app.buttons["keyboardDismissButton"].tap()

        let create = app.buttons["savingsGoalFormSubmit"]
        XCTAssertTrue(create.isEnabled)
        create.tap()

        assertProbe("savingsGoalUITestCreateCount", equals: "1")
        assertProbe("savingsGoalUITestLastGoalName", equals: "Coussin de sécurité")
        attachScreenshot("ios-form-name-only")
    }

    func testInvalidIntervalCannotBeSaved() {
        launch("UITEST_SAVINGS_GOAL_FORM_INVALID_INTERVAL")

        let save = app.buttons["savingsGoalFormSubmit"]
        XCTAssertTrue(save.waitForExistence(timeout: 10))
        XCTAssertFalse(save.isEnabled)
        assertProbe("savingsGoalUITestUpdateCount", equals: "0")
        attachScreenshot("ios-form-invalid-interval")
    }

    func testFourDetailStatesRenderOnlyApplicableRegions() {
        for expectation in Self.detailExpectations {
            launch(expectation.scenario)
            XCTAssertTrue(app.scrollViews["savingsGoalDetailRoot"].waitForExistence(timeout: 10))
            XCTAssertEqual(identified("savingsGoalTargetProgressBar").exists, expectation.hasTarget)
            if let deadlineIdentifier = expectation.deadlineIdentifier {
                XCTAssertTrue(identified(deadlineIdentifier).exists)
            } else {
                XCTAssertFalse(identified("savingsGoalDeadlineDate").exists)
                XCTAssertFalse(identified("savingsGoalDeadlineRange").exists)
            }
            XCTAssertEqual(identified("savingsGoalProjectionStat").exists, expectation.hasProjection)
            XCTAssertEqual(
                identified("savingsGoalRequiredPaceStat").exists,
                expectation.hasRequiredAmount
            )
            XCTAssertEqual(identified("savingsGoalEstimatedCompletion").exists, expectation.hasEstimation)
            XCTAssertEqual(
                identified("savingsGoalCompletionSuggestionCard").exists,
                expectation.hasSuggestion
            )
            XCTAssertEqual(identified("savingsGoalTrajectoryTitle").exists, expectation.hasTrajectory)
            XCTAssertEqual(app.buttons["savingsGoalAdjustPlanButton"].exists, expectation.canAdjust)
            XCTAssertEqual(identified("savingsGoalPaceIndicator").exists, expectation.hasPace)
            attachScreenshot("\(expectation.scenario.lowercased())-light-large")
            app.terminate()
        }
    }

    func testAccessibilityDynamicTypeKeepsFormAndDetailActionable() {
        launch("UITEST_SAVINGS_GOAL_FORM", dynamicType: true)

        let name = app.textFields["savingsGoalNameField"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Projet accessible")
        app.buttons["keyboardDismissButton"].tap()

        let create = app.buttons["savingsGoalFormSubmit"]
        scrollUntilHittable(create)
        attachScreenshot("ios-form-light-accessibility3")
        create.tap()
        assertProbe("savingsGoalUITestCreateCount", equals: "1")

        app.terminate()
        launch("UITEST_SAVINGS_GOAL_DETAIL_FULL", dynamicType: true)

        let adjust = app.buttons["savingsGoalAdjustPlanButton"]
        XCTAssertTrue(adjust.waitForExistence(timeout: 10))
        scrollUntilHittable(adjust)
        attachScreenshot("ios-detail-full-light-accessibility3")
        adjust.tap()
        XCTAssertTrue(app.scrollViews["goalPlanSimulatorRoot"].waitForExistence(timeout: 10))
    }

    func testDeadlineReconciliationCancelWritesNothing() {
        openDeadlineReconciliation(darkMode: true)

        XCTAssertTrue(app.buttons["goalGenerationStopFreezeButton"].exists)
        XCTAssertTrue(app.buttons["goalGenerationStopRemoveButton"].exists)
        attachScreenshot("ios-deadline-confirmation-dark-large")
        app.buttons["goalGenerationStopCancelButton"].tap()

        assertProbe("savingsGoalUITestUpdateCount", equals: "0")
    }

    func testDeadlineReconciliationFreezeWritesOnce() {
        openDeadlineReconciliation()

        app.buttons["goalGenerationStopFreezeButton"].tap()

        assertProbe("savingsGoalUITestUpdateCount", equals: "1")
        assertProbe("savingsGoalUITestReconciliationMode", equals: "freeze")
        attachScreenshot("ios-deadline-freeze-light-large")
    }

    func testDeadlineReconciliationRemoveWritesOnce() {
        openDeadlineReconciliation()

        app.buttons["goalGenerationStopRemoveButton"].tap()

        assertProbe("savingsGoalUITestUpdateCount", equals: "1")
        assertProbe("savingsGoalUITestReconciliationMode", equals: "remove")
        attachScreenshot("ios-deadline-remove-light-large")
    }

    func testTemplateLineShowsGoalChipOnlyWhenLinked() {
        launch("UITEST_SAVINGS_GOAL_TEMPLATE_LINES")

        // Both line names are harness fixtures, not product copy.
        XCTAssertTrue(app.staticTexts["Épargne voyage"].waitForExistence(timeout: 10))
        XCTAssertTrue(
            identified("templateLineGoalChip-\(Self.linkedTemplateLineId)").waitForExistence(timeout: 10)
        )
        XCTAssertTrue(app.staticTexts["Épargne libre"].exists)
        XCTAssertFalse(identified("templateLineGoalChip-\(Self.freeTemplateLineId)").exists)
        attachScreenshot("ios-template-linked-goal-light-large")
    }

    private func openDeadlineReconciliation(darkMode: Bool = false) {
        launch("UITEST_SAVINGS_GOAL_DEADLINE_RECONCILIATION", darkMode: darkMode)

        let edit = app.buttons["savingsGoalEditButton"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()

        let closeKeyboard = app.buttons["keyboardDismissButton"]
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

        // System calendar cell: its label comes from the simulator's language, not
        // from the app's copy, and it carries no identifier we can set.
        let day = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "15 juillet")).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 3))
        day.tap()

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.2)).tap()
        app.buttons["savingsGoalFormSubmit"].tap()
        XCTAssertTrue(identified("goalGenerationStopDeadlineRoot").waitForExistence(timeout: 10))
    }

    private func launch(
        _ scenario: String,
        dynamicType: Bool = false,
        darkMode: Bool = false
    ) {
        app = XCUIApplication()
        // Pin the app process to French: the deadline flow taps a system calendar
        // cell by its label, which follows the process language, not the app's copy.
        app.launchArguments = ["-\(scenario)", "-AppleLanguages", "(fr)"]
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

    private func identified(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
