import SwiftUI

// MARK: - Navigation Destinations

enum BudgetDestination: Hashable {
    case details(budgetId: String)
    /// An operation's « Modifier » page on its own, for the accueil: one push, and Back
    /// returns where the tap came from. Inside the budget page the same page is reached
    /// through `BudgetLinePushRoute.editTx`.
    case editTransaction(budgetId: String, transactionId: String)
}

enum SavingsGoalDestination: Hashable {
    case list
    case detail(SavingsGoal)
}

enum TemplateDestination: Hashable { case details(templateId: String) }

// MARK: - Per-Section Navigation Stacks

extension AppState {
    var canChangeBudgetRoot: Bool { budgetPath.isEmpty && budgetRouter.sheet == nil }

    /// Root entries select a month; deeper budget links still push on their origin stack.
    func openBudget(_ id: String, year: Int? = nil) {
        guard canChangeBudgetRoot else {
            toastManager.show(AppLocale.string("Ferme cet écran avant de changer de mois."), type: .error)
            return
        }
        if selectedBudgetId != id { budgetYear = nil }
        updateBudgetSelection(id, year: year)
        selectedTab = .budgets
    }

    /// The loaded detail resolves the year even for a deep link absent from the list cache.
    func updateBudgetSelection(_ id: String, year: Int?) {
        selectedBudgetId = id
        if let year { budgetYear = year }
    }

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
        case .budgets:
            budgetPath = NavigationPath()
            selectedBudgetId = nil
        case .savingsGoals: savingsGoalsPath = NavigationPath()
        case .templates: templatePath = NavigationPath()
        }
    }
}
