import XCTest

@MainActor
final class LanguageSettingUITests: XCTestCase {
    private static let scenario = "UITEST_LANGUAGE_SETTINGS"
    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    override func tearDown() async throws {
        Self.restorePersistedLocale()
        try await super.tearDown()
    }

    func testMenuOffersNativeNamesAndConfirmsSelection() {
        launch()

        let language = app.buttons["languageSettingPicker"]
        XCTAssertTrue(language.waitForExistence(timeout: 10), app.debugDescription)
        assertMinimumHitArea(language)
        XCTAssertEqual(language.value as? String, "Français")
        language.tap()

        for name in ["Français", "English", "Deutsch", "Italiano"] {
            XCTAssertTrue(app.buttons[name].waitForExistence(timeout: 5), app.debugDescription)
        }

        app.buttons["Italiano"].tap()
        let confirmed = NSPredicate(format: "value == %@", "Italiano")
        expectation(for: confirmed, evaluatedWith: language)
        waitForExpectations(timeout: 5)
        XCTAssertEqual(language.value as? String, "Italiano")
    }

    func testVisualMatrixKeepsRowsActionable() {
        for (scheme, dynamicType) in [
            ("light", "large"),
            ("dark", "large"),
            ("light", "accessibility3"),
            ("dark", "accessibility3"),
        ] {
            launch(colorScheme: scheme, dynamicType: dynamicType)

            let language = app.buttons["languageSettingPicker"]
            let systemLanguage = app.buttons["systemLanguageLink"]
            scrollUntilHittable(language)
            scrollUntilHittable(systemLanguage)
            attachScreenshot("language-settings-\(scheme)-\(dynamicType)")
            assertMinimumHitArea(language)
            assertMinimumHitArea(systemLanguage)
            XCTAssertFalse(language.frame.intersects(systemLanguage.frame))
            app.terminate()
        }
    }

    private func launch(colorScheme: String = "light", dynamicType: String = "large") {
        app = XCUIApplication()
        app.launchArguments = ["-\(Self.scenario)"]
        app.launchEnvironment["UITEST_SCENARIO"] = Self.scenario
        app.launchEnvironment["UITEST_COLOR_SCHEME"] = colorScheme
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = dynamicType
        app.launch()
    }

    private func assertMinimumHitArea(_ element: XCUIElement) {
        XCTAssertTrue(element.isHittable)
        XCTAssertGreaterThanOrEqual(element.frame.width, 44)
        XCTAssertGreaterThanOrEqual(element.frame.height, 44)
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private static func restorePersistedLocale() {
        let cleanupApp = XCUIApplication()
        cleanupApp.terminate()
        cleanupApp.launchArguments = ["-\(scenario)"]
        cleanupApp.launchEnvironment["UITEST_SCENARIO"] = scenario
        cleanupApp.launch()
        let language = cleanupApp.buttons["languageSettingPicker"]
        let exists = language.waitForExistence(timeout: 5)
        let restoredValue = language.value as? String
        let debugDescription = cleanupApp.debugDescription
        cleanupApp.terminate()
        XCTAssertTrue(exists, debugDescription)
        XCTAssertEqual(restoredValue, "Français")
    }
}
