import XCTest

@MainActor
final class FeedbackUITests: XCTestCase {
    private static let scenario = "UITEST_LANGUAGE_SETTINGS"
    private static let feedbackAreaLabels = [
        "Création de mon premier budget",
        "Clarté de l'interface",
        "Gestion du budget du mois",
        "Planification des prochains mois",
        "Clarté de l'accueil",
    ]
    private var app = XCUIApplication()

    func testFormRemainsAccessibleAtAccessibilityDynamicType() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-\(Self.scenario)", "-AppleLanguages", "(fr)"]
        app.launchEnvironment["UITEST_SCENARIO"] = Self.scenario
        app.launchEnvironment["UITEST_FEEDBACK"] = "1"
        app.launchEnvironment["UITEST_DYNAMIC_TYPE"] = "accessibility3"
        app.launch()

        let openFeedback = app.buttons["openFeedback"]
        scrollUntilHittable(openFeedback)
        XCTAssertTrue(openFeedback.isHittable)
        XCTAssertGreaterThanOrEqual(openFeedback.frame.width, 44)
        XCTAssertGreaterThanOrEqual(openFeedback.frame.height, 44)
        XCTAssertEqual(openFeedback.label, "Donner mon avis")
        openFeedback.tap()

        XCTAssertTrue(
            app.staticTexts["Comment ça se passe avec Pulpe ?"].waitForExistence(timeout: 10),
            app.debugDescription
        )
        for label in ["À améliorer", "Difficile", "Correct", "Bien", "Très bien"] {
            XCTAssertTrue(app.buttons[label].exists, "Missing accessible rating \(label)")
        }

        let details = app.buttons["Préciser mon avis"]
        scrollUntilHittable(details)
        details.tap()
        for label in Self.feedbackAreaLabels {
            XCTAssertTrue(app.staticTexts[label].exists, "Missing concrete feedback area \(label)")
        }

        let comment = app.textFields["feedbackComment"]
        for _ in 0..<4 {
            app.swipeUp()
        }
        XCTAssertTrue(comment.isHittable, app.debugDescription)
        XCTAssertEqual(comment.label, "Commentaire facultatif")
        comment.tap()
        comment.typeText("Clair 😀 et utile")
        XCTAssertEqual(comment.value as? String, "Clair 😀 et utile")
        app.buttons["keyboardDismissButton"].tap()

        let submit = app.buttons["feedbackSubmit"]
        scrollUntilHittable(submit)
        XCTAssertFalse(submit.isEnabled)

        try app.performAccessibilityAudit(for: [
            .dynamicType,
            .hitRegion,
            .sufficientElementDescription,
            .textClipped,
            .trait,
        ])
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }
}
