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
        let template: Int
        let keyboard: Bool
        let hidden: Bool

        var testDescription: String {
            let kb = keyboard ? "kb=on" : "kb=off"
            return "tab=\(tab.rawValue) b=\(budget) t=\(template) \(kb) → hidden=\(hidden)"
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
            templatePathDepth: scenario.template,
            keyboardVisible: scenario.keyboard
        )

        #expect(result == scenario.hidden)
    }
}
