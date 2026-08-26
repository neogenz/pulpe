import XCTest

@MainActor
final class ContextualCreationUITests: XCTestCase {
    /// Every amount on this screen is printed with its currency, and nothing else is —
    /// so the code is what tells an announced figure from a masked one, in any language.
    private static let currencyCode = "CHF"

    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testHomeCreationActionRemainsAccessibleAtLargeText() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME")

        let addOperation = app.buttons["homeAddOperationButton"]
        scrollUntilHittable(addOperation)
        assertMinimumHitArea(addOperation)
        attachScreenshot("contextual-creation-home-accessibility3")

        addOperation.tap()
        XCTAssertTrue(app.buttons["addTransactionSubmit"].firstMatch.waitForExistence(timeout: 5))
    }

    func testHomeListPreservesTwoZonesAndScrollsFromActivity() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large", marketingGain: true)

        let hero = app.descendants(matching: .any)["home-balance-chart"]
        XCTAssertTrue(hero.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["homeAddOperationButton"].exists, app.debugDescription)
        attachScreenshot("home-list-two-zone-top")

        let activity = app.staticTexts["homeActivityRow-marketing-bonus"]
        scrollUntilHittable(activity)
        let initialY = hero.frame.minY
        activity.swipeDown()

        XCTAssertGreaterThan(hero.frame.minY, initialY, app.debugDescription)
        attachScreenshot("home-list-scrolled-from-activity")
    }

    func testBudgetToolbarActionsRemainDistinctAtLargeText() {
        launch("UITEST_CONTEXTUAL_CREATION_BUDGET")

        let tracking = app.buttons["budgetTrackingButton"]
        let addForecast = app.buttons["budgetAddLineButton"]
        XCTAssertTrue(tracking.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(addForecast.waitForExistence(timeout: 10), app.debugDescription)
        attachScreenshot("contextual-creation-budget-accessibility3")
        assertMinimumHitArea(tracking)
        assertMinimumHitArea(addForecast)
        XCTAssertFalse(tracking.frame.intersects(addForecast.frame))

        addForecast.tap()
        XCTAssertTrue(app.buttons["addBudgetLineSubmit"].firstMatch.waitForExistence(timeout: 5))
    }

    /// One plot has to carry every shape a month can take. Each state gets a screenshot so
    /// the set can be read side by side — a chart that is clear alone can still be
    /// unreadable next to its neighbours. Both schemes, because the two labels and the line
    /// carry the card's ink and only dark says whether it still separates from its surface.
    func testHomeChartStaysLegibleAcrossDataStates() {
        let states = ["firstDay", "untouched", "onPlan", "quiet", "gain", "overrun", "deficit", "history", "lastDay"]
        for colorScheme in ["light", "dark"] {
            for state in states {
                launch(
                    "UITEST_CONTEXTUAL_CREATION_HOME",
                    dynamicType: "large",
                    colorScheme: colorScheme,
                    chartState: state
                )

                let chart = app.descendants(matching: .any)["home-balance-chart"]
                XCTAssertTrue(
                    chart.waitForExistence(timeout: 10),
                    "\(colorScheme)/\(state): \(app.debugDescription)"
                )
                attachScreenshot("home-chart-state-\(colorScheme)-\(state)")
                app.terminate()
            }
        }
    }

    func testHomeChartAnnotationsAcrossVisualMatrix() {
        for colorScheme in ["light", "dark"] {
            for dynamicType in ["large", "accessibility3"] {
                for period in ["calendar", "shifted"] {
                    launch(
                        "UITEST_CONTEXTUAL_CREATION_HOME",
                        dynamicType: dynamicType,
                        colorScheme: colorScheme,
                        chartPeriod: period
                    )

                    let chart = app.descendants(matching: .any)["home-balance-chart"]
                    XCTAssertTrue(chart.waitForExistence(timeout: 10), app.debugDescription)
                    attachScreenshot("home-chart-\(colorScheme)-\(dynamicType)-\(period)")
                    app.terminate()
                }
            }
        }
    }

    func testHomeSkeletonUsesProductionContainer() {
        launch(
            "UITEST_CONTEXTUAL_CREATION_HOME",
            dynamicType: "large",
            homeSkeleton: true
        )

        let skeleton = app.descendants(matching: .any)["homeSkeletonRoot"]
        XCTAssertTrue(skeleton.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["homeAccountButton"].exists, app.debugDescription)

        // `SwiftUI.Tab` gives no seam for an identifier on the bar button it builds, so
        // the production container is asserted by its four tabs rather than their titles.
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.exists, app.debugDescription)
        XCTAssertEqual(tabBar.buttons.count, 4, app.debugDescription)

        attachScreenshot("home-skeleton-production-container")
    }

    /// The screen a new account sees the moment onboarding hands it over: a budget whose
    /// lines are still nothing but plans, and not one transaction. It has to read as a month
    /// under way with a first move to make, not as a broken or half-loaded page.
    func testFreshSignupHomeIsFilledAndSaysWhatIsMissing() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large", freshSignup: true)

        // The estimate and its plot: the page has a subject, not an empty frame. The plot
        // draws the month's whole slope before anything is pointed, and its label is the
        // assertable proof of it — the marks themselves are a graphic.
        let chart = app.descendants(matching: .any)["home-balance-chart"]
        XCTAssertTrue(chart.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(
            chart.label.contains(Self.currencyCode),
            "The plot announces no figure: \(chart.label)"
        )

        // The verdict sentence's own copy is asserted in `HomeHeroCardTests`: it lives in a
        // Button whose accessibility label is its action, so its text reaches no query here.

        // The one thing to do, and the card listing what is waiting to be pointed.
        scrollUntilHittable(app.buttons["homeAddOperationButton"])
        let uncheckedCard = app.descendants(matching: .any)["homeUncheckedOperationsCard"]
        scrollUntilHittable(uncheckedCard)
        // The income the template opened the budget with — the harness names it, so the
        // row proves the card is showing the line and not an empty frame.
        let uncheckedRow = app.descendants(matching: .any)["homeUncheckedOperationRow"].firstMatch
        XCTAssertTrue(uncheckedRow.exists, app.debugDescription)
        XCTAssertTrue(uncheckedRow.label.contains("Revenu"), uncheckedRow.label)

        // Nothing has happened yet, so no card may report activity or drift.
        app.swipeUp()
        XCTAssertFalse(
            app.descendants(matching: .any)["homeActivityCard"].exists,
            app.debugDescription
        )
        XCTAssertFalse(app.descendants(matching: .any)["homeDriftCard"].exists, app.debugDescription)

        attachScreenshot("home-fresh-signup")
    }

    /// Every shortcut on the accueil pushes through `appState.currentMonthPath`, and only a
    /// stack bound to it moves. A harness that wraps `CurrentMonthView` in its own stack
    /// swallows all five of them, and a tap that does nothing looks exactly like a tap that
    /// missed its target — this is the test that tells the two apart.
    func testHomeShortcutPushesTheBudgetDetail() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large")

        let seeDetail = app.buttons["homeBudgetDetailLink"]
        XCTAssertTrue(seeDetail.waitForExistence(timeout: 10), app.debugDescription)
        seeDetail.tap()

        XCTAssertTrue(
            app.buttons["budgetAddLineButton"].waitForExistence(timeout: 10),
            "Le tap n'a rien poussé — écran après le tap : "
                + "\(app.descendants(matching: .any).allElementsBoundByIndex.map(\.label))"
        )
    }

    /// Masking is a promise about the whole screen, and the screen speaks before it draws:
    /// a card that keeps its amount in its accessibility label hands back, out loud, exactly
    /// what the toggle was pressed to hide. (The drawn figures are blurred rather than
    /// removed, so the pixels are the screenshot's job, not an assertion's.)
    func testHiddenAmountsAreSpokenAsMaskedAcrossTheHome() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large", amountsHidden: true)

        let chart = app.descendants(matching: .any)["home-balance-chart"]
        XCTAssertTrue(chart.waitForExistence(timeout: 10), app.debugDescription)

        // The hero speaks neither its estimate nor its comparison.
        let hero = app.buttons["homeHeroMetrics"]
        XCTAssertTrue(hero.exists, app.debugDescription)
        XCTAssertFalse(
            hero.label.contains(Self.currencyCode),
            "Le héros annonce encore un montant : \(hero.label)"
        )
        // The plot too — it is one accessibility element with its whole trajectory inside.
        XCTAssertFalse(
            chart.label.contains(Self.currencyCode),
            "Le graphe annonce encore sa trajectoire : \(chart.label)"
        )
        // And the card below, whose rows each carry an amount of their own.
        let uncheckedRow = app.descendants(matching: .any)["homeUncheckedOperationRow"].firstMatch
        XCTAssertTrue(uncheckedRow.exists, app.debugDescription)
        XCTAssertTrue(uncheckedRow.label.contains("Logement"), uncheckedRow.label)
        XCTAssertFalse(
            uncheckedRow.label.contains(Self.currencyCode),
            "La ligne à pointer annonce son montant : \(uncheckedRow.label)"
        )

        attachScreenshot("home-amounts-hidden")
    }

    private func launch(
        _ scenario: String,
        dynamicType: String = "accessibility3",
        colorScheme: String? = nil,
        chartPeriod: String? = nil,
        chartState: String? = nil,
        homeSkeleton: Bool = false,
        freshSignup: Bool = false,
        amountsHidden: Bool = false,
        marketingGain: Bool = false
    ) {
        app = XCUIApplication()
        app.launchArguments = ["-\(scenario)"]
        app.launchEnvironment["UITEST_SCENARIO"] = scenario
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = dynamicType
        if let colorScheme {
            app.launchEnvironment["UITEST_COLOR_SCHEME"] = colorScheme
        }
        if let chartPeriod {
            app.launchEnvironment["UITEST_HOME_CHART_MATRIX"] = "1"
            app.launchEnvironment["UITEST_CHART_PERIOD"] = chartPeriod
        }
        if let chartState {
            app.launchEnvironment["UITEST_HOME_CHART_MATRIX"] = "1"
            app.launchEnvironment["UITEST_CHART_STATE"] = chartState
        }
        if homeSkeleton {
            app.launchEnvironment["UITEST_HOME_SKELETON"] = "1"
        }
        if freshSignup {
            app.launchEnvironment["UITEST_HOME_FRESH_SIGNUP"] = "1"
        }
        if amountsHidden {
            app.launchEnvironment["UITEST_AMOUNTS_HIDDEN"] = "1"
        }
        if marketingGain {
            app.launchEnvironment["UITEST_HOME_MARKETING_GAIN"] = "1"
        }
        app.launch()
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
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

@MainActor
final class HomeActivitySwipeUITests: XCTestCase {
    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testFullSwipeOnlyRevealsActionsAndDeleteRequiresConfirmation() {
        launchHome()
        let row = activityRow()

        row.swipeLeft()

        XCTAssertFalse(app.buttons["homeActivityConfirmDelete"].exists)
        let delete = app.buttons["homeActivityDelete-marketing-bonus"]
        XCTAssertTrue(delete.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.buttons["homeActivityEdit-marketing-bonus"].exists)

        delete.tap()

        let confirmation = app.buttons["homeActivityConfirmDelete"]
        XCTAssertTrue(confirmation.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.alerts.firstMatch.label.contains("Bonus"))
        XCTAssertTrue(row.exists)

        let cancel = app.buttons.matching(identifier: "homeActivityCancelDelete").firstMatch
        XCTAssertTrue(cancel.exists)
        cancel.tap()
        XCTAssertFalse(confirmation.exists)
        XCTAssertTrue(row.exists)
    }

    func testEditActionOpensExistingTransaction() {
        launchHome()
        let row = activityRow()
        row.swipeLeft()

        let edit = app.buttons["homeActivityEdit-marketing-bonus"]
        XCTAssertTrue(edit.waitForExistence(timeout: 5), app.debugDescription)
        edit.tap()

        XCTAssertTrue(app.navigationBars["Edit"].waitForExistence(timeout: 10), app.debugDescription)
    }

    func testActionsRemainVisibleAcrossAppearanceMatrix() {
        let appearances = [
            (colorScheme: "light", dynamicType: "large"),
            (colorScheme: "dark", dynamicType: "large"),
            (colorScheme: "light", dynamicType: "accessibility3")
        ]

        for appearance in appearances {
            launchHome(colorScheme: appearance.colorScheme, dynamicType: appearance.dynamicType)
            activityRow().swipeLeft()

            XCTAssertTrue(
                app.buttons["homeActivityEdit-marketing-bonus"].waitForExistence(timeout: 5),
                app.debugDescription
            )
            XCTAssertTrue(app.buttons["homeActivityDelete-marketing-bonus"].exists, app.debugDescription)
            attachScreenshot("home-swipe-\(appearance.colorScheme)-\(appearance.dynamicType)")
            app.terminate()
        }
    }

    private func launchHome(colorScheme: String? = nil, dynamicType: String = "large") {
        app = XCUIApplication()
        app.launchArguments = ["-UITEST_CONTEXTUAL_CREATION_HOME"]
        app.launchEnvironment["UITEST_SCENARIO"] = "UITEST_CONTEXTUAL_CREATION_HOME"
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = dynamicType
        app.launchEnvironment["UITEST_HOME_MARKETING_GAIN"] = "1"
        if let colorScheme {
            app.launchEnvironment["UITEST_COLOR_SCHEME"] = colorScheme
        }
        app.launch()
    }

    private func activityRow() -> XCUIElement {
        let row = app.descendants(matching: .any)["homeActivityRow-marketing-bonus"]
        for _ in 0..<8 where !row.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(row.isHittable, app.debugDescription)
        return row
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
