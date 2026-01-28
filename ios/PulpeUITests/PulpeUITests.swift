import XCTest

final class PulpeUITests: XCTestCase {

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

    func testAppLaunches() {
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }
}
