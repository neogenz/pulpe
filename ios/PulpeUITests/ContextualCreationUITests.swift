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

        let skeleton = app.descendants(matching: .any)["Préparation de ton tableau de bord"]
        XCTAssertTrue(skeleton.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["Mon compte"].exists, app.debugDescription)

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.exists, app.debugDescription)
        for title in ["Accueil", "Budgets", "Objectifs", "Modèles"] {
            XCTAssertTrue(tabBar.buttons[title].exists, app.debugDescription)
        }

        attachScreenshot("home-skeleton-production-container")
    }

    /// The screen a new account sees the moment onboarding hands it over: a budget whose
    /// lines are still nothing but plans, and not one transaction. It has to read as a month
    /// under way with a first move to make, not as a broken or half-loaded page.
    func testFreshSignupHomeIsFilledAndSaysWhatIsMissing() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large", freshSignup: true)

        // The estimate and its plot: the page has a subject, not an empty frame.
        XCTAssertTrue(
            app.descendants(matching: .any)["home-balance-chart"].waitForExistence(timeout: 10),
            app.debugDescription
        )
        XCTAssertTrue(app.staticTexts["En attente d’un premier pointage"].exists, app.debugDescription)

        // The verdict sentence's own copy is asserted in `HomeHeroCardTests`: it lives in a
        // Button whose accessibility label is its action, so its text reaches no query here.

        // The one thing to do, and the card listing what is waiting to be pointed.
        XCTAssertTrue(app.buttons["Ajouter une opération"].exists, app.debugDescription)
        XCTAssertTrue(app.staticTexts["Opérations à pointer"].exists, app.debugDescription)
        XCTAssertTrue(app.staticTexts["Revenu"].exists, app.debugDescription)

        // Nothing has happened yet, so no card may report activity or drift.
        XCTAssertFalse(app.staticTexts["Activité"].exists, app.debugDescription)
        XCTAssertFalse(app.staticTexts["Ça dérive"].exists, app.debugDescription)

        attachScreenshot("home-fresh-signup")
    }

    /// Every shortcut on the accueil pushes through `appState.currentMonthPath`, and only a
    /// stack bound to it moves. A harness that wraps `CurrentMonthView` in its own stack
    /// swallows all five of them, and a tap that does nothing looks exactly like a tap that
    /// missed its target — this is the test that tells the two apart.
    func testHomeShortcutPushesTheBudgetDetail() {
        launch("UITEST_CONTEXTUAL_CREATION_HOME", dynamicType: "large")

        let seeDetail = app.buttons["Voir le détail du budget"]
        XCTAssertTrue(seeDetail.waitForExistence(timeout: 10), app.debugDescription)
        seeDetail.tap()

        XCTAssertTrue(
            app.buttons["Ajouter une prévision"].waitForExistence(timeout: 10),
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

        XCTAssertTrue(
            app.descendants(matching: .any)["home-balance-chart"].waitForExistence(timeout: 10),
            app.debugDescription
        )

        let labels = app.descendants(matching: .any).allElementsBoundByIndex.map(\.label)

        // The hero speaks neither its estimate nor its comparison.
        XCTAssertTrue(
            labels.contains { $0.contains("montant masqué") && $0.contains("Comparaison au budget masquée") },
            "Le héros annonce encore un montant : \(labels)"
        )
        // The plot too — it is one accessibility element with its whole trajectory inside.
        XCTAssertTrue(
            labels.contains { $0.contains("Évolution du solde sur la période, montants masqués") },
            "Le graphe annonce encore sa trajectoire : \(labels)"
        )
        // And the card below, whose rows each carry an amount of their own.
        XCTAssertEqual(
            labels.first { $0.hasPrefix("Logement,") },
            "Logement, récurrent",
            "La ligne à pointer annonce son montant : \(labels)"
        )

        attachScreenshot("home-amounts-hidden")
    }

    private func launch(
        _ scenario: String,
        dynamicType: String = "accessibility3",
        colorScheme: String? = nil,
        chartPeriod: String? = nil,
        homeSkeleton: Bool = false,
        freshSignup: Bool = false,
        amountsHidden: Bool = false
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
        if homeSkeleton {
            app.launchEnvironment["UITEST_HOME_SKELETON"] = "1"
        }
        if freshSignup {
            app.launchEnvironment["UITEST_HOME_FRESH_SIGNUP"] = "1"
        }
        if amountsHidden {
            app.launchEnvironment["UITEST_AMOUNTS_HIDDEN"] = "1"
        }
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
