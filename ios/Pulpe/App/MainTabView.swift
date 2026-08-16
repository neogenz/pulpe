import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        TabView(selection: $state.selectedTab) {
            SwiftUI.Tab(
                Tab.currentMonth.title,
                systemImage: Tab.currentMonth.icon,
                value: Tab.currentMonth
            ) {
                CurrentMonthTab()
            }

            SwiftUI.Tab(
                Tab.budgets.title,
                systemImage: Tab.budgets.icon,
                value: Tab.budgets
            ) {
                BudgetsTab()
            }

            SwiftUI.Tab(
                Tab.savingsGoals.title,
                systemImage: Tab.savingsGoals.icon,
                value: Tab.savingsGoals
            ) {
                SavingsGoalsTab()
            }

            SwiftUI.Tab(
                Tab.templates.title,
                systemImage: Tab.templates.icon,
                value: Tab.templates
            ) {
                TemplatesTab()
            }
        }
        .tint(Color.pulpePrimary)
        .pulpeBackground()
        .onChange(of: appState.selectedTab) { _, newTab in
            AnalyticsService.shared.capture(.tabSwitched, properties: ["tab": newTab.rawValue])
        }
        .task {
            #if DEBUG
            guard let rawValue = ProcessInfo.processInfo.environment["UITEST_CAPTURE_TAB"],
                  let tab = Tab(rawValue: rawValue) else { return }
            appState.selectedTab = tab
            #endif
        }
    }
}

// MARK: - Budget destinations

/// Resolves a budget destination for the stacks that use the default services.
/// `BudgetsTab` keeps its own switch — it is the one entry point that injects
/// test doubles.
@ViewBuilder
private func budgetDestination(_ destination: BudgetDestination) -> some View {
    switch destination {
    case .details(let budgetId):
        BudgetDetailsView(budgetId: budgetId)
    }
}

// MARK: - Current Month Tab

struct CurrentMonthTab: View {
    @Environment(AppState.self) private var appState
    @State private var router = BudgetDetailsRouter()

    var body: some View {
        @Bindable var state = appState

        // The accueil is a set of shortcuts into budgets and objectifs, so it registers
        // their destinations too: a shortcut that switched tabs instead of pushing left
        // the back button pointing at the other section's root.
        NavigationStack(path: $state.currentMonthPath) {
            CurrentMonthView()
                .navigationDestination(for: BudgetDestination.self) { destination in
                    budgetDestination(destination)
                }
                .navigationDestination(for: SavingsGoalDestination.self) { destination in
                    switch destination {
                    case .list:
                        SavingsGoalsListView()
                    case .detail(let goal):
                        SavingsGoalDetailView(goal: goal)
                    }
                }
        }
        .environment(router)
        .task { router.bind(to: appState) }
    }
}

// MARK: - Savings Goals Tab

struct SavingsGoalsTab: View {
    @Environment(AppState.self) private var appState
    /// A goal's withdrawal history leads into the budgets it funded (PUL-329), so
    /// this stack hosts budget screens too — and they need the same router the
    /// other two tabs provide.
    @State private var router = BudgetDetailsRouter()

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.savingsGoalsPath) {
            SavingsGoalsListView()
                .navigationDestination(for: SavingsGoalDestination.self) { destination in
                    switch destination {
                    case .list:
                        SavingsGoalsListView()
                    case .detail(let goal):
                        SavingsGoalDetailView(goal: goal)
                    }
                }
                .navigationDestination(for: BudgetDestination.self) { destination in
                    budgetDestination(destination)
                }
        }
        .environment(router)
        .task { router.bind(to: appState) }
    }
}

// MARK: - Budgets Tab

struct BudgetsTab: View {
    @Environment(AppState.self) private var appState
    private let budgetService: any BudgetServicing
    private let budgetLineService: any BudgetLineServicing
    private let savingsGoalService: any SavingsGoalServicing
    /// Tab-scoped router instance. Owns sheet state and provides the typed
    /// push API used inside the BudgetDetails feature; `appState.budgetPath`
    /// remains the underlying NavigationPath surface for cross-feature
    /// entries (deep link, BudgetList CTA, CurrentMonth CTA).
    @State private var router = BudgetDetailsRouter()

    init(
        budgetService: any BudgetServicing = BudgetService.shared,
        budgetLineService: any BudgetLineServicing = BudgetLineService.shared,
        savingsGoalService: any SavingsGoalServicing = SavingsGoalService.shared
    ) {
        self.budgetService = budgetService
        self.budgetLineService = budgetLineService
        self.savingsGoalService = savingsGoalService
    }

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.budgetPath) {
            BudgetListView()
                .navigationDestination(for: BudgetDestination.self) { destination in
                    switch destination {
                    case .details(let budgetId):
                        BudgetDetailsView(
                            budgetId: budgetId,
                            budgetService: budgetService,
                            budgetLineService: budgetLineService
                        )
                    }
                }
                // A saving prévision's detail can push its linked goal's
                // progression (PUL-12) — same destination as the CurrentMonth
                // stack, registered here for the budget branch.
                .navigationDestination(for: SavingsGoalDestination.self) { destination in
                    switch destination {
                    case .list:
                        SavingsGoalsListView()
                    case .detail(let goal):
                        SavingsGoalDetailView(goal: goal, service: savingsGoalService)
                    }
                }
        }
        .environment(router)
        .task { router.bind(to: appState) }
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
                            .accessibilityIdentifier("templateDetailsRoot")
                    }
                }
        }
    }
}
