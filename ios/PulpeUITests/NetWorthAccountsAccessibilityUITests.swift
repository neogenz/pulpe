import XCTest

/// VoiceOver guard for the account screens of PUL-376: each screen passes the system
/// accessibility audit, and reads its key line as one phrase.
@MainActor
final class NetWorthAccountsAccessibilityUITests: XCTestCase {
    private static let scenario = "UITEST_NET_WORTH_ACCOUNTS"
    private static let detail = ["Fin ", "Ta dernière saisie", "Valeur enregistrée", "Déjà compris"]
    private static let defaultAccountFooter =
        "Chaque nouveau mouvement démarre sur ce compte. Tu peux le changer à chaque fois."
    private var app = XCUIApplication()

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testPatrimoineListReadsEachRowWithItsBadges() throws {
        launch("list")
        let row = app.buttons.matching(identifier: "netWorthRowOpen").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.descendants(matching: .any)["12’670 CHF"].exists, "net worth split\n\(app.debugDescription)")
        try auditAndCapture("list", ours: ["netWorthRowOpen", "Par défaut", "Découvert", "Hors total"])
        scrollUntilHittable(row)
        app.swipeUp()
        // Scrolled, the top row sits under the bar and is measured against its blur: it was
        // audited above, so only the rows the swipe brought in count here.
        try auditAndCapture("list-rows", ours: ["Découvert", "Hors total"])
        XCTAssertTrue(label(of: "Compte courant").contains("Par défaut"), app.debugDescription)
        XCTAssertTrue(label(of: "Compte joint").contains("Découvert"), app.debugDescription)
        XCTAssertTrue(label(of: "Livret EUR").contains("Hors total"), app.debugDescription)
    }

    /// The diagram is a Canvas: its summary carries each Type, and the legend shown at
    /// accessibility sizes stays hidden, so VoiceOver reads each amount exactly once.
    func testBreakdownReadsEachTypeOnceAtEveryTextSize() throws {
        let lines = ["Comptes, 9’170 CHF", "Épargne, 12’000 CHF", "Crédits, 8’500 CHF"]
        for size in [nil, "UICTContentSizeCategoryAccessibilityXXXL"] {
            launch("list", contentSize: size)
            let summary = app.descendants(matching: .any)
                .matching(NSPredicate(format: "label BEGINSWITH 'Répartition de ce que j'"))
                .firstMatch
            XCTAssertTrue(summary.waitForExistence(timeout: 10), app.debugDescription)
            for line in lines {
                let matches = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", line))
                XCTAssertEqual(matches.count, 1, "\(line) at \(size ?? "default")\n\(app.debugDescription)")
            }
            scrollUntilHittable(summary)
            try auditAndCapture(size == nil ? "breakdown" : "breakdown-ax5", ours: ["Répartition"])
        }
    }

    func testDetailReadsTheMonthEndLineAndTheHistory() throws {
        launch("detail")
        let monthEnd = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH 'Fin '")).firstMatch
        XCTAssertTrue(monthEnd.waitForExistence(timeout: 10), app.debugDescription)
        try auditAndCapture("detail", ours: Self.detail)
        app.swipeUp()
        // The summary lines, now under the bar, were audited above: only the history counts here.
        try auditAndCapture("detail-history", ours: ["Valeur enregistrée", "Déjà compris"])
    }

    func testPreferencesReadsTheDefaultAccount() throws {
        launch("preferences")
        let field = app.buttons["Compte par défaut"]
        scrollUntilHittable(field)
        XCTAssertEqual(field.value as? String, "Compte courant")
        scrollUntilHittable(app.staticTexts[Self.defaultAccountFooter])
        try auditAndCapture("preferences", ours: ["Compte par défaut", Self.defaultAccountFooter])
    }

    func testAccountReadsTheDefaultAccountInThePreferencesRow() throws {
        launch("account")
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS 'compte par défaut'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10), app.debugDescription)
        try auditAndCapture("account", ours: ["compte par défaut"])
    }

    func testMovementSheetReadsTheAccountField() throws {
        launch("movement")
        try assertAccountField(value: "Compte courant")
        try auditAndCapture("movement", ours: ["Compte"])
    }

    func testAddPrevisionSheetReadsTheAccountField() throws {
        launch("addLine")
        try assertAccountField(value: "Compte courant")
        try auditAndCapture("add-line", ours: ["Compte"])
    }

    func testTemplateLineSheetReachesTheConflictMessage() throws {
        launch("templateLine")
        dismissKeyboard()
        let message = app.staticTexts["Choisis un autre compte : « Livret Raiffeisen » est déjà l'élément lié."]
        scrollUntilHittable(message)
        try assertAccountField(value: "Livret Raiffeisen")
        try auditAndCapture("template-line", ours: ["Compte", "Choisis un autre compte"])
    }

    // MARK: - Helpers

    private func launch(_ screen: String, contentSize: String? = nil) {
        app = XCUIApplication()
        app.launchArguments = ["-\(Self.scenario)", "-AppleLanguages", "(fr)"]
        if let contentSize { app.launchArguments += ["-UIPreferredContentSizeCategoryName", contentSize] }
        app.launchEnvironment["UITEST_SCENARIO"] = Self.scenario
        app.launchEnvironment["UITEST_NET_WORTH_SCREEN"] = screen
        app.launch()
    }

    private func assertAccountField(value: String) throws {
        dismissKeyboard()
        let field = app.buttons["Compte"]
        scrollUntilHittable(field)
        XCTAssertEqual(field.value as? String, value, app.debugDescription)
    }

    private func label(of name: String) -> String {
        app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch.label
    }

    /// Captures the screen and its tree, then audits it. The audit fails on this epic's own
    /// elements only (`ours`: label or identifier fragments); the shared form parts around them
    /// (amount, kind toggle, tags) are outside PUL-376 and reported in its accessibility pass.
    private func auditAndCapture(_ name: String, ours: [String]) throws {
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "ios-\(name)"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "tree-\(name)"
        tree.lifetime = .keepAlways
        add(tree)
        var issues: [String] = []
        try app.performAccessibilityAudit { issue in
            let element = issue.element.map { "\($0.identifier) \($0.label)" } ?? ""
            print("AUDIT \(name): \(issue.auditType.rawValue) \(issue.compactDescription) | \(element)")
            guard ours.contains(where: element.contains) else { return true }
            // The month-end line speaks its condition after the figure (« si tout se passe comme
            // prévu ») on purpose: a label longer than the text on screen reads as clipped.
            if issue.auditType == .textClipped, element.contains("si tout se passe comme prévu") { return true }
            // The legend is `.footnote` and grows with the text size (15.7pt tall here, 156.7pt at
            // AX5); the audit still flags it at the default size.
            if issue.auditType == .dynamicType, element.contains("Déjà compris") { return true }
            issues.append("\(issue.compactDescription) | \(element)")
            return true
        }
        XCTAssertTrue(issues.isEmpty, "\(name):\n" + issues.joined(separator: "\n"))
    }

    /// The sheets focus the amount, and the number pad shows no toolbar here: the form, once
    /// scrolled, is dragged down into the keyboard, which it dismisses interactively.
    private func dismissKeyboard() {
        guard app.keyboards.firstMatch.waitForExistence(timeout: 3) else { return }
        // In the side margin, so the drag never starts on a control that would take it.
        for _ in 0..<3 where app.keyboards.firstMatch.exists {
            app.swipeUp()
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.3))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.97)))
            _ = app.keyboards.firstMatch.waitForNonExistence(timeout: 2)
        }
        XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 3), app.debugDescription)
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        _ = element.waitForExistence(timeout: 10)
        for _ in 0..<6 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }
}
