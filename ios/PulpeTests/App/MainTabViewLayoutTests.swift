import Foundation
@testable import Pulpe
import Testing

/// Behavior tests for the floating tab bar visibility rule. Drives the pure
/// helper `MainTabView.shouldHideFloatingTabBar`, which encodes the contract
/// the previous source-grep tests were trying to pin via spelling.
@Suite("MainTabView floating tab bar visibility")
struct MainTabViewLayoutTests {
    struct Scenario: Sendable, CustomTestStringConvertible {
        let tab: Tab
        let budget: Int
        let savings: Int
        let template: Int
        let keyboard: Bool
        let hidden: Bool

        init(
            tab: Tab,
            budget: Int,
            savings: Int = 0,
            template: Int,
            keyboard: Bool,
            hidden: Bool
        ) {
            self.tab = tab
            self.budget = budget
            self.savings = savings
            self.template = template
            self.keyboard = keyboard
            self.hidden = hidden
        }

        var testDescription: String {
            let kb = keyboard ? "kb=on" : "kb=off"
            return "tab=\(tab.rawValue) b=\(budget) s=\(savings) t=\(template) \(kb) → hidden=\(hidden)"
        }
    }

    @Test(
        "Floating tab bar hides on keyboard or per-tab drill-down",
        arguments: [
            // Current Month: never hides from drill-down; only keyboard.
            Scenario(tab: .currentMonth, budget: 0, template: 0, keyboard: false, hidden: false),
            Scenario(tab: .currentMonth, budget: 5, template: 5, keyboard: false, hidden: false),
            Scenario(tab: .currentMonth, budget: 0, template: 0, keyboard: true, hidden: true),

            // Budgets: hides only when budgetPath drills past root.
            Scenario(tab: .budgets, budget: 0, template: 0, keyboard: false, hidden: false),
            Scenario(tab: .budgets, budget: 1, template: 0, keyboard: false, hidden: false),
            Scenario(tab: .budgets, budget: 2, template: 0, keyboard: false, hidden: true),
            Scenario(tab: .budgets, budget: 0, template: 9, keyboard: false, hidden: false),
            Scenario(tab: .budgets, budget: 1, template: 0, keyboard: true, hidden: true),

            // Savings goals: root is empty; the first push is already a detail.
            Scenario(tab: .savingsGoals, budget: 0, savings: 0, template: 0, keyboard: false, hidden: false),
            Scenario(tab: .savingsGoals, budget: 0, savings: 1, template: 0, keyboard: false, hidden: true),
            Scenario(tab: .savingsGoals, budget: 9, savings: 0, template: 9, keyboard: false, hidden: false),
            Scenario(tab: .savingsGoals, budget: 0, savings: 0, template: 0, keyboard: true, hidden: true),

            // Templates: hides only when templatePath drills past root.
            Scenario(tab: .templates, budget: 0, template: 0, keyboard: false, hidden: false),
            Scenario(tab: .templates, budget: 0, template: 1, keyboard: false, hidden: false),
            Scenario(tab: .templates, budget: 0, template: 2, keyboard: false, hidden: true),
            Scenario(tab: .templates, budget: 9, template: 1, keyboard: false, hidden: false),
            Scenario(tab: .templates, budget: 0, template: 1, keyboard: true, hidden: true)
        ]
    )
    func shouldHideFloatingTabBar_matchesContract(scenario: Scenario) {
        let result = MainTabView.shouldHideFloatingTabBar(
            selectedTab: scenario.tab,
            budgetPathDepth: scenario.budget,
            savingsGoalsPathDepth: scenario.savings,
            templatePathDepth: scenario.template,
            keyboardVisible: scenario.keyboard
        )

        #expect(result == scenario.hidden)
    }
}

@Suite("MainTabView navigation ownership")
struct MainTabViewNavigationOwnershipTests {
    private static func iosSource(_ components: [String]) -> URL {
        var url = URL(fileURLWithPath: #filePath)
        url = url.deletingLastPathComponent() // App/
        url = url.deletingLastPathComponent() // PulpeTests/
        url = url.deletingLastPathComponent() // ios/
        return components.reduce(url) { $0.appendingPathComponent($1) }
    }

    private static func read(_ components: String...) throws -> String {
        try String(contentsOf: iosSource(components), encoding: .utf8)
    }

    @Test("Global tab bar owns navigation only")
    func globalTabBarOwnsNavigationOnly() throws {
        let source = try Self.read("Pulpe", "App", "MainTabView.swift")

        #expect(Tab.allCases.count == 4)
        #expect(source.contains("ForEach(Tab.allCases)"))
        #expect(!source.contains("AddTransactionSheet("))
        #expect(!source.contains("actionFAB("))
    }

    @Test("Current Month owns transaction creation")
    func currentMonthOwnsTransactionCreation() throws {
        let source = try Self.read(
            "Pulpe",
            "Features",
            "CurrentMonth",
            "CurrentMonthView.swift"
        )

        #expect(source.contains("case addTransaction"))
        #expect(source.contains("AddTransactionSheet("))
        #expect(source.contains("onAdd: store.addTransaction"))
    }

    @Test("Current Month transaction action fills its declared hit area")
    func currentMonthTransactionActionFillsHitArea() throws {
        let source = try Self.read(
            "Pulpe",
            "Features",
            "CurrentMonth",
            "CurrentMonthView.swift"
        )
        guard let start = source.range(of: #"Button("Ajouter une opération""#),
              let end = source.range(
                  of: #".accessibilityLabel("Ajouter une opération")"#,
                  range: start.upperBound..<source.endIndex
              )
        else {
            Issue.record("Missing Current Month transaction action")
            return
        }

        let action = source[start.lowerBound..<end.upperBound]
        guard let frame = action.range(of: "minHeight: DesignTokens.TapTarget.minimum"),
              let contentShape = action.range(of: ".contentShape(Rectangle())"),
              let pressedStyle = action.range(of: ".plainPressedButtonStyle()")
        else {
            Issue.record("Transaction action must declare its frame, content shape and pressed style")
            return
        }

        #expect(frame.lowerBound < contentShape.lowerBound)
        #expect(contentShape.lowerBound < pressedStyle.lowerBound)
    }
}

/// Bar top above the physical bottom + the content spacing — the clearance to
/// reserve when the device contributes no bottom safe area of its own. Derived
/// from the same tokens the production formula uses (not magic).
private let fullTabBarClearance: CGFloat =
    DesignTokens.Spacing.xxl
    + DesignTokens.FrameHeight.tabBar
    + DesignTokens.Spacing.md

/// Bottom clearance the floating bar reserves for content, given the device's
/// bottom safe-area inset. The bar is placed from the physical bottom while
/// content respects the safe area, so the formula subtracts the inset (already
/// reserved by `safeAreaInset`) and clamps at zero.
@Suite("MainTabView floating tab bar clearance")
struct MainTabViewClearanceTests {
    struct Case: Sendable, CustomTestStringConvertible {
        let inset: CGFloat
        let expected: CGFloat
        let label: String

        var testDescription: String { "\(label): inset=\(inset) → \(expected)" }
    }

    @Test(
        "Clearance subtracts the device bottom inset, clamped at zero",
        arguments: [
            // No safe area (e.g. a device without a home indicator): reserve the
            // full distance from the physical bottom to the bar top + spacing.
            Case(inset: 0, expected: fullTabBarClearance, label: "no safe area"),
            // Standard iPhone home-indicator inset: subtracted (content's own
            // safeAreaInset already reserves it).
            Case(inset: 34, expected: fullTabBarClearance - 34, label: "standard iPhone"),
            // Inset exactly equal to the bar footprint: nothing left to reserve.
            Case(inset: fullTabBarClearance, expected: 0, label: "boundary"),
            // Safe area already clears the bar: never reserve a negative amount.
            Case(inset: fullTabBarClearance + 50, expected: 0, label: "safe area exceeds bar footprint")
        ]
    )
    func tabBarClearance_accountsForSafeAreaInset(testCase: Case) {
        #expect(
            MainTabView.tabBarClearance(bottomSafeAreaInset: testCase.inset) == testCase.expected
        )
    }
}
