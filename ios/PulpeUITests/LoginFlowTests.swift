import XCTest

final class LoginFlowTests: XCTestCase {

    private var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDown() {
        app = nil
        super.tearDown()
    }

    func testLoginScreenElementsExist() {
        let emailField = app.textFields["email"]
        let passwordField = app.secureTextFields["password"]
        let loginButton = app.buttons["loginButton"]

        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Email field should exist")
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field should exist")
        XCTAssertTrue(loginButton.waitForExistence(timeout: 5), "Login button should exist")
    }
}
