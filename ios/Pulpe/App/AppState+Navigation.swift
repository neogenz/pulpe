import SwiftUI

// MARK: - Navigation Destinations

enum BudgetDestination: Hashable {
    case details(budgetId: String)
}

enum SavingsGoalDestination: Hashable {
    case list
    case detail(SavingsGoal)
}

enum TemplateDestination: Hashable { case details(templateId: String) }

// MARK: - Per-Section Navigation Stacks

extension AppState {
    /// Pushes onto the stack of the section currently on screen. A tab preserves its own
    /// navigation state, so a screen reached from the accueil belongs to the accueil's
    /// stack: appending to another tab's path builds a history its back button unwinds
    /// into a place the user never came from.
    func pushOnActiveStack(_ value: some Hashable) {
        switch selectedTab {
        case .currentMonth: currentMonthPath.append(value)
        case .budgets: budgetPath.append(value)
        case .savingsGoals: savingsGoalsPath.append(value)
        case .templates: templatePath.append(value)
        }
    }

    /// Unwinds the on-screen section back to its root, for the same reason.
    func popActiveStackToRoot() {
        switch selectedTab {
        case .currentMonth: currentMonthPath = NavigationPath()
        case .budgets: budgetPath = NavigationPath()
        case .savingsGoals: savingsGoalsPath = NavigationPath()
        case .templates: templatePath = NavigationPath()
        }
    }
}
