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
        if ProcessInfo.processInfo.environment["UITEST_HOME_SKELETON"] == "1" {
            currentMonthStore.prepareLoadingForTesting()
        } else {
            currentMonthStore.populateForTesting(budget: budget, budgetLines: lines)
        }
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
            .suppressesTips()
            .environment(\.dynamicTypeSize, dynamicTypeSize)
            .preferredColorScheme(preferredColorScheme)
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

    private var preferredColorScheme: ColorScheme? {
        switch ProcessInfo.processInfo.environment["UITEST_COLOR_SCHEME"] {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    private var isChartMatrixEnabled: Bool {
        ProcessInfo.processInfo.environment["UITEST_HOME_CHART_MATRIX"] == "1"
    }

    private var isHomeSkeletonEnabled: Bool {
        ProcessInfo.processInfo.environment["UITEST_HOME_SKELETON"] == "1"
    }

    private var isShiftedPeriod: Bool {
        ProcessInfo.processInfo.environment["UITEST_CHART_PERIOD"] == "shifted"
    }

    @ViewBuilder
    private var content: some View {
        switch scenario {
        case .contextualCreationHome:
            if isHomeSkeletonEnabled {
                MainTabView()
            } else if isChartMatrixEnabled {
                chartMatrixContent
            } else {
                NavigationStack {
                    CurrentMonthView()
                }
            }
        case .contextualCreationBudget:
            NavigationStack {
                BudgetDetailsView(budgetId: budgetId)
            }
        default:
            EmptyView()
        }
    }

    private var chartMatrixContent: some View {
        let fixture = chartFixture

        return ScrollView {
            HomeHeroCard(
                metrics: fixture.metrics,
                plannedBalance: fixture.plannedBalance,
                trajectory: fixture.trajectory,
                monthName: fixture.monthName,
                uncheckedCount: 1,
                onTapMetrics: {},
                onTapDetail: {}
            )
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.xxxl)
        }
        .background(Color.homeHeroSurface.ignoresSafeArea())
    }

    private var chartFixture: ChartFixture {
        let referenceDate = isShiftedPeriod
            ? Self.date(year: 2026, month: 3, day: 10)
            : Self.date(year: 2026, month: 7, day: 15)
        let payDay = isShiftedPeriod ? 27 : nil
        let budgetMonth = isShiftedPeriod ? 3 : 7
        let monthName = isShiftedPeriod ? "mars" : "juillet"
        let budget = Budget(
            id: budgetId, month: budgetMonth, year: 2026,
            description: "Chart UI Test", userId: "ui-test-user", templateId: "ui-test-template",
            endingBalance: 2_500, rollover: nil, remaining: 2_500, previousBudgetId: nil,
            createdAt: referenceDate, updatedAt: referenceDate
        )
        let transactions = isShiftedPeriod
            ? [
                transaction(
                    id: "first",
                    amount: 500,
                    date: Self.date(year: 2026, month: 2, day: 28)
                ),
                transaction(
                    id: "second",
                    amount: 600,
                    date: Self.date(year: 2026, month: 3, day: 4)
                ),
                transaction(
                    id: "third",
                    amount: 400,
                    date: Self.date(year: 2026, month: 3, day: 9)
                ),
            ]
            : [
                transaction(
                    id: "first",
                    amount: 500,
                    date: Self.date(year: 2026, month: 7, day: 2)
                ),
                transaction(
                    id: "second",
                    amount: 600,
                    date: Self.date(year: 2026, month: 7, day: 8)
                ),
                transaction(
                    id: "third",
                    amount: 400,
                    date: Self.date(year: 2026, month: 7, day: 14)
                ),
            ]
        let metrics = BudgetFormulas.Metrics(
            totalIncome: 5_000,
            totalExpenses: 2_500,
            totalSavings: 0,
            available: 5_000,
            endingBalance: 2_500,
            remaining: 2_500,
            rollover: 0
        )
        guard let trajectory = BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: transactions,
            metrics: metrics,
            plannedBalance: 2_500,
            budget: budget,
            payDayOfMonth: payDay,
            referenceDate: referenceDate
        ) else {
            preconditionFailure("Chart UI test trajectory must exist")
        }
        return ChartFixture(
            metrics: metrics,
            plannedBalance: 2_500,
            trajectory: trajectory,
            monthName: monthName
        )
    }

    private func transaction(id: String, amount: Decimal, date: Date) -> Transaction {
        Transaction(
            id: "chart-\(id)",
            budgetId: budgetId,
            budgetLineId: nil,
            name: id,
            amount: amount,
            kind: .expense,
            transactionDate: date,
            category: nil,
            checkedAt: date,
            createdAt: date,
            updatedAt: date
        )
    }

    private static func date(year: Int, month: Int, day: Int) -> Date {
        guard let date = Calendar.current.date(from: DateComponents(
            year: year,
            month: month,
            day: day,
            hour: 12
        )) else {
            preconditionFailure("Invalid chart UI test date")
        }
        return date
    }

    private struct ChartFixture {
        let metrics: BudgetFormulas.Metrics
        let plannedBalance: Decimal
        let trajectory: BudgetFormulas.BalanceTrajectory
        let monthName: String
    }
}
