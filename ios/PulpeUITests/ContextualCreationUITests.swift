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

    func testTappingAnActivityRowOpensItsEditSheetAndClosingReturnsToTheAccueil() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large", marketingGain: true)

        let row = app.buttons["movementRow-marketing-bonus"]
        scrollUntilHittable(row)
        row.tap()

        // « Modifier » is a sheet now: its save button tells it is up.
        let save = app.buttons["movementSave"]
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)

        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["homeActivityCard"].waitForExistence(timeout: 5),
            app.debugDescription
        )
    }

    func testBudgetSectionAddRowsStayReachableAtLargeText() {
        launch("UITEST_CONTEXTUAL_CREATION_BUDGET")

        // Each section ends on its own « Ajouter une prévision » row; the expense one is
        // always there on a seeded month.
        let addForecast = app.buttons["budgetSectionAdd-expense"]
        scrollUntilHittable(addForecast)
        attachScreenshot("contextual-creation-budget-accessibility3")
        // Laid out by us, so the 44 pt rule applies to it in full.
        assertMinimumHitArea(addForecast)

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

        // The estimate: the page has a subject, not an empty frame. A first month has no
        // slope to draw yet, so the hero leaves its plot out and keeps the figure.
        let amount = app.descendants(matching: .any)["homeProjectedBalanceAmount"]
        XCTAssertTrue(amount.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(
            amount.label.contains(Self.currencyCode),
            "The hero announces no figure: \(amount.label)"
        )
        XCTAssertFalse(app.descendants(matching: .any)["home-balance-chart"].exists, app.debugDescription)

        // The verdict sentence's own copy is asserted in `HomeHeroCardTests`: it lives in a
        // Button whose accessibility label is its action, so its text reaches no query here.

        // A first month has nothing to point yet: the home says how to start instead.
        XCTAssertTrue(
            app.descendants(matching: .any)["homeStartAddExpense"].exists,
            app.debugDescription
        )
        XCTAssertFalse(app.descendants(matching: .any)["homeTodoDrift"].exists, app.debugDescription)

        attachScreenshot("home-fresh-signup")
    }

    /// Every shortcut on the accueil pushes through `appState.currentMonthPath`, and only a
    /// stack bound to it moves. A harness that wraps `CurrentMonthView` in its own stack
    /// swallows all five of them, and a tap that does nothing looks exactly like a tap that
    /// missed its target — this is the test that tells the two apart.
    func testSeeAllPushesTheMovementsPage() {
        // « Tout voir » only shows once the month has a movement to list.
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large", marketingGain: true)

        let viewAll = app.buttons["homeActivityViewAll"]
        XCTAssertTrue(viewAll.waitForExistence(timeout: 10), app.debugDescription)
        viewAll.tap()

        // The movements page's search is a plain text field (`PulpeSearchField`), not a
        // system search field; its filter chips are what only that page draws.
        XCTAssertTrue(
            app.buttons["movementsFilter-all"].firstMatch.waitForExistence(timeout: 10),
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
        // And the rows below, which each carry an amount of their own.
        let movement = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'movementRow-'")
        ).firstMatch
        if movement.exists {
            XCTAssertFalse(
                movement.label.contains(Self.currencyCode),
                "La ligne annonce son montant : \(movement.label)"
            )
        }

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
        // Frames come back with float noise (a 44 pt button reads 43.999…); what the
        // finger gets is pixel-snapped, so compare that.
        let scale = UIScreen.main.scale
        let snapped = { (points: CGFloat) in (points * scale).rounded() / scale }
        XCTAssertGreaterThanOrEqual(snapped(element.frame.width), 44)
        XCTAssertGreaterThanOrEqual(snapped(element.frame.height), 44)
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
