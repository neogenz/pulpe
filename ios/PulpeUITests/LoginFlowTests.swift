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
        let forgotPasswordButton = app.buttons["forgotPasswordButton"]

        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Email field should exist")
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field should exist")
        XCTAssertTrue(loginButton.waitForExistence(timeout: 5), "Login button should exist")
        XCTAssertTrue(forgotPasswordButton.waitForExistence(timeout: 5), "Forgot password button should exist")
    }

    func testForgotPasswordSheetCanBeOpenedFromLogin() {
        let forgotPasswordButton = app.buttons["forgotPasswordButton"]
        XCTAssertTrue(forgotPasswordButton.waitForExistence(timeout: 10), "Forgot password button should exist")

        forgotPasswordButton.tap()

        let forgotPasswordPage = app.otherElements["forgotPasswordPage"]
        let forgotPasswordEmail = app.textFields["forgotPasswordEmail"]

        XCTAssertTrue(forgotPasswordPage.waitForExistence(timeout: 5), "Forgot password page should be visible")
        XCTAssertTrue(forgotPasswordEmail.waitForExistence(timeout: 5), "Forgot password email field should exist")
    }
}
