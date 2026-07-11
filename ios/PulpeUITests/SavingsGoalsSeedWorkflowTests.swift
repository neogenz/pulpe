import XCTest

/// Local, non-CI capture of the savings goals journey on the seed account.
///
/// Two deliberately separate tests, run one at a time by
/// `ios/scripts/capture-savings-goals-workflow.sh`:
///
/// - `testBootstrapAuthenticatedSession` reads the capture secrets from the UI
///   test *runner* environment (`PULPE_CAPTURE_EMAIL/PASSWORD/PIN`, forwarded by
///   the script as `TEST_RUNNER_*`) and performs a real login. It persists the
///   Supabase session in the simulator keychain, so the capture test that runs
///   afterwards is already authenticated and never has to touch a secret.
/// - `testCaptureSavingsGoalsWorkflow` reads only `PULPE_CAPTURE_PIN` (no email /
///   password): the session persists across cold starts but the vault re-locks,
///   so it re-enters the PIN (masked pad, no email shown) then drives tab → list
///   → detail → suivi → simulator (draft only, cancelled) and attaches the four
///   screenshots the script exports.
///
/// The secrets never touch argv, a plist, or a file — only the runner env and the
/// fields they are typed into. Failure messages here stay secret-free on purpose
/// (no `debugDescription` that would dump the typed email). The script that drives
/// this keeps every xcodebuild activity log (which records the typed email and the
/// ordered PIN taps) in a scratch dir it scrubs on exit — never in the shareable
/// artifacts folder.
@MainActor
final class SavingsGoalsSeedWorkflowTests: XCTestCase {
    /// Floating tab-bar entry for the goals tab (`Tab.savingsGoals.title`).
    private let authenticatedAnchor = "Objectifs"

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    // MARK: - 1) Bootstrap (secrets in, no capture)

    func testBootstrapAuthenticatedSession() throws {
        let env = ProcessInfo.processInfo.environment
        guard
            let email = env["PULPE_CAPTURE_EMAIL"], !email.isEmpty,
            let password = env["PULPE_CAPTURE_PASSWORD"], !password.isEmpty,
            let pin = env["PULPE_CAPTURE_PIN"], !pin.isEmpty
        else {
            throw XCTSkip(
                "Bootstrap needs PULPE_CAPTURE_EMAIL / PULPE_CAPTURE_PASSWORD / PULPE_CAPTURE_PIN "
                + "in the runner environment. Run via ios/scripts/capture-savings-goals-workflow.sh."
            )
        }

        let app = XCUIApplication()
        app.launch()

        // Email + password (identifiers from LoginView).
        let emailField = app.textFields["email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 20), "Login screen should present the email field.")
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Login screen should present the password field.")
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["loginButton"].tap()

        // PIN. First run creates it (entered twice), later runs enter it once. No
        // identifiers exist on the numpad, so it is driven by digit labels. Enter
        // once, and only re-enter if the authenticated shell has not appeared —
        // that adaptively covers both the setup and the entry screens.
        let shell = app.buttons[authenticatedAnchor]
        enterPin(pin, in: app)
        if !shell.waitForExistence(timeout: 8) {
            enterPin(pin, in: app)
        }

        XCTAssertTrue(
            shell.waitForExistence(timeout: 20),
            "Bootstrap should land on the authenticated shell (the “Objectifs” tab)."
        )
    }

    // MARK: - 2) Capture (PIN unlock only — no email)

    func testCaptureSavingsGoalsWorkflow() throws {
        // The Supabase session persists across cold starts, but the encryption
        // vault re-locks — so a cold launch lands on the PIN screen, not the
        // shell (AppState clears the client key on every cold start). Re-enter
        // the PIN to unlock: the PIN pad is masked and no email is shown, so the
        // captured media stays free of readable secrets.
        guard let pin = ProcessInfo.processInfo.environment["PULPE_CAPTURE_PIN"], !pin.isEmpty else {
            throw XCTSkip(
                "Capture needs PULPE_CAPTURE_PIN to unlock the vault on cold start. "
                + "Run via ios/scripts/capture-savings-goals-workflow.sh."
            )
        }

        let app = XCUIApplication()
        app.launch()

        let objectifsTab = app.buttons[authenticatedAnchor]
        if !objectifsTab.waitForExistence(timeout: 6) {
            enterPin(pin, in: app) // cold-start vault unlock
        }
        guard objectifsTab.waitForExistence(timeout: 20) else {
            XCTFail(
                "Did not reach the authenticated shell — run testBootstrapAuthenticatedSession "
                + "first, and check PULPE_CAPTURE_PIN."
            )
            return
        }
        objectifsTab.tap()

        // 01 — liste
        let list = firstElement(app, id: "savingsGoalsListRoot")
        XCTAssertTrue(list.waitForExistence(timeout: 15), "Savings goals list root should appear.")
        attach(app, name: "01-objectifs-liste")

        // 02 — détail (first seeded goal row)
        let firstRow = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH 'savingsGoalRow-'"))
            .firstMatch
        XCTAssertTrue(firstRow.waitForExistence(timeout: 10), "The seed should expose at least one goal row.")
        firstRow.tap()

        let detail = firstElement(app, id: "savingsGoalDetailRoot")
        XCTAssertTrue(detail.waitForExistence(timeout: 15), "Detail root should appear.")
        attach(app, name: "02-objectif-detail")

        // 03 — suivi réel ("Ton suivi", shown only when the goal has linked lines)
        let suivi = firstElement(app, id: "savingsGoalContributionsSection")
        if suivi.waitForExistence(timeout: 10) {
            suivi.swipeUp()
        }
        attach(app, name: "03-objectif-suivi")

        // 04 — simulateur en brouillon puis annulation SANS appliquer
        captureSimulator(app)
    }

    /// Opens the plan simulator, shows a draft redistribution, screenshots it,
    /// then cancels WITHOUT applying (non-destructive — never taps "Appliquer").
    private func captureSimulator(_ app: XCUIApplication) {
        let adjust = app.buttons["Ajuster mon plan"]
        guard adjust.waitForExistence(timeout: 8) else {
            attach(app, name: "04-objectif-simulateur")
            return
        }
        adjust.tap()
        let simulator = firstElement(app, id: "goalPlanSimulatorRoot")
        XCTAssertTrue(simulator.waitForExistence(timeout: 10), "Simulator root should appear.")

        let redistribute = app.buttons["Réajuster la suite"]
        if redistribute.waitForExistence(timeout: 3) {
            redistribute.tap()
        }
        attach(app, name: "04-objectif-simulateur")

        // Cancel: a dirty draft raises the discard confirmation.
        app.buttons["Annuler"].tap()
        let discard = app.buttons["Abandonner"]
        if discard.waitForExistence(timeout: 3) {
            discard.tap()
        }
    }

    // MARK: - Helpers

    private func enterPin(_ pin: String, in app: XCUIApplication) {
        for digit in pin {
            let key = app.buttons[String(digit)]
            if key.waitForExistence(timeout: 5) {
                key.tap()
            }
        }
    }

    /// Resolves an accessibility identifier regardless of the element's concrete
    /// type (a `List` is a table, a `ScrollView` a scroll view, a section an
    /// "other" element), so callers need not guess the query bucket.
    private func firstElement(_ app: XCUIApplication, id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
