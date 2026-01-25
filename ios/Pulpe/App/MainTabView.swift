import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        TabView(selection: $state.selectedTab) {
            CurrentMonthTab()
                .tabItem {
                    Label(Tab.currentMonth.title, systemImage: Tab.currentMonth.icon)
                }
                .tag(Tab.currentMonth)

            BudgetsTab()
                .tabItem {
                    Label(Tab.budgets.title, systemImage: Tab.budgets.icon)
                }
                .tag(Tab.budgets)

            TemplatesTab()
                .tabItem {
                    Label(Tab.templates.title, systemImage: Tab.templates.icon)
                }
                .tag(Tab.templates)
        }
    }
}

// MARK: - Current Month Tab

struct CurrentMonthTab: View {
    var body: some View {
        NavigationStack {
            CurrentMonthView()
        }
    }
}

// MARK: - Budgets Tab

struct BudgetsTab: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.budgetPath) {
            BudgetListView()
                .navigationDestination(for: BudgetDestination.self) { destination in
                    switch destination {
                    case .details(let budgetId):
                        BudgetDetailsView(budgetId: budgetId)
                    }
                }
        }
    }
}

// MARK: - Templates Tab

struct TemplatesTab: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.templatePath) {
            TemplateListView()
                .navigationDestination(for: TemplateDestination.self) { destination in
                    switch destination {
                    case .details(let templateId):
                        TemplateDetailsView(templateId: templateId)
                    }
                }
        }
    }
}
