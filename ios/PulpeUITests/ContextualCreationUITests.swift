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

    private func launch(
        _ scenario: String,
        dynamicType: String = "accessibility3",
        colorScheme: String? = nil,
        chartPeriod: String? = nil,
        homeSkeleton: Bool = false
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
