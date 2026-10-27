import SwiftUI

extension EnvironmentValues {
    /// Set by `BudgetsTab` when the year's months sit beside this page (the open iPhone
    /// Duo): the list is the month picker, so the sticky pager steps aside.
    @Entry var budgetMonthsInSidebar = false
}

/// Keeps the months list and the page beside it on the same month. A month picked in the
/// list arrives as a new `budgetId`; a month picked here (title menu) goes back to the list
/// through `AppState.budgetSelection`. Inert anywhere else, so a page pushed from the
/// accueil never moves the budgets section.
struct BudgetSidebarSelectionSync: ViewModifier {
    let budgetId: String
    let coordinator: BudgetDetailsCoordinator

    @Environment(AppState.self) private var appState
    @Environment(\.budgetMonthsInSidebar) private var isInSidebarLayout

    func body(content: Content) -> some View {
        if isInSidebarLayout {
            content
                .onChange(of: budgetId) { _, id in
                    guard id != coordinator.dataStore.budgetId else { return }
                    Task { await coordinator.dispatch(.prepareNavigation(to: id)) }
                }
                .onChange(of: coordinator.dataStore.budgetId) { _, id in
                    appState.budgetSelection = id
                }
        } else {
            content
        }
    }
}
