import SwiftUI

struct ContextualCreationUITestHarness: View {
    let scenario: UITestLaunchScenario

    @State private var appState = AppState()
    @State private var currentMonthStore: CurrentMonthStore
    @State private var budgetListStore = BudgetListStore()
    @State private var dashboardStore = DashboardStore()
    @State private var userSettingsStore = UserSettingsStore()
    @State private var savingsGoalStore = SavingsGoalStore()
    @State private var tagStore = TagStore()
    @State private var router = BudgetDetailsRouter()

    private let budgetId = "contextual-creation-budget"

    init(scenario: UITestLaunchScenario) {
        self.scenario = scenario

        let now = Date()
        let period = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: nil)
        let budget = Budget(
            id: budgetId, month: period.month, year: period.year,
            description: "Budget UI Test", userId: "ui-test-user", templateId: "ui-test-template",
            endingBalance: 2_500, rollover: nil, remaining: 2_500, previousBudgetId: nil,
            createdAt: now, updatedAt: now
        )
        let lines = [
            BudgetLine(
                id: "ui-test-income", budgetId: budgetId,
                templateLineId: nil, savingsGoalId: nil, name: "Revenu",
                amount: 5_000, kind: .income, recurrence: .fixed,
                isManuallyAdjusted: false, checkedAt: now,
                createdAt: now, updatedAt: now
            ),
            BudgetLine(
                id: "ui-test-expense", budgetId: budgetId,
                templateLineId: nil, savingsGoalId: nil, name: "Logement",
                amount: 2_500, kind: .expense, recurrence: .fixed,
                isManuallyAdjusted: false, checkedAt: nil,
                createdAt: now, updatedAt: now
            ),
        ]

        let currentMonthStore = CurrentMonthStore()
        #if DEBUG
        currentMonthStore.populateForTesting(budget: budget, budgetLines: lines)
        #endif
        _currentMonthStore = State(initialValue: currentMonthStore)

        BudgetDetailCache.shared.invalidateAll()
        BudgetDetailCache.shared.store(
            budgetId: budgetId,
            budget: budget,
            budgetLines: lines,
            transactions: []
        )
        BudgetDetailCache.shared.storeAllBudgets([
            BudgetSparse(
                id: budgetId, month: period.month, year: period.year,
                totalExpenses: 2_500, totalIncome: 5_000, remaining: 2_500
            ),
        ])
    }

    var body: some View {
        content
            .environment(\.dynamicTypeSize, dynamicTypeSize)
            .environment(appState)
            .environment(currentMonthStore)
            .environment(budgetListStore)
            .environment(dashboardStore)
            .environment(userSettingsStore)
            .environment(savingsGoalStore)
            .environment(tagStore)
            .environment(router)
            .environment(appState.toastManager)
    }

    private var dynamicTypeSize: DynamicTypeSize {
        ProcessInfo.processInfo.environment["UITEST_DYNAMIC_TYPE"] == "accessibility3"
            ? .accessibility3
            : .large
    }

    @ViewBuilder
    private var content: some View {
        switch scenario {
        case .contextualCreationHome:
            NavigationStack {
                CurrentMonthView()
            }
        case .contextualCreationBudget:
            NavigationStack {
                BudgetDetailsView(budgetId: budgetId)
            }
        default:
            EmptyView()
        }
    }
}
