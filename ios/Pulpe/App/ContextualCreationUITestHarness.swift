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
        // Right after onboarding nothing has been pointed at all — not even the income the
        // template opened the budget with. That one difference is what makes the Accueil's
        // first-run state reachable from a test.
        let isFreshSignup = ProcessInfo.processInfo.environment["UITEST_HOME_FRESH_SIGNUP"] == "1"
        let lines = [
            BudgetLine(
                id: "ui-test-income", budgetId: budgetId,
                templateLineId: nil, savingsGoalId: nil, name: "Revenu",
                amount: 5_000, kind: .income, recurrence: .fixed,
                isManuallyAdjusted: false, checkedAt: isFreshSignup ? nil : now,
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
        let transactions = marketingGainTransactions(budgetId: budgetId, period: period, now: now)

        let currentMonthStore = CurrentMonthStore()
        #if DEBUG
        if ProcessInfo.processInfo.environment["UITEST_HOME_SKELETON"] == "1" {
            currentMonthStore.prepareLoadingForTesting()
        } else {
            currentMonthStore.populateForTesting(budget: budget, budgetLines: lines, transactions: transactions)
        }
        #endif
        _currentMonthStore = State(initialValue: currentMonthStore)

        BudgetDetailCache.shared.invalidateAll()
        BudgetDetailCache.shared.store(
            budgetId: budgetId,
            budget: budget,
            budgetLines: lines,
            transactions: transactions
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
            .environment(\.amountsHidden, areAmountsHidden)
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
            // Injecting the router is only half its wiring: `push` and `popToRoot` go
            // through a weak `AppState` the router only gets from `bind`, so an unbound
            // router turns every push in `BudgetDetailsView` into a silent no-op. The
            // harness renders that view, so without this a test that taps a line would
            // fail with nothing on screen and no reason why. Mirrors `MainTabView:80`.
            .task { router.bind(to: appState) }
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

    private var areAmountsHidden: Bool {
        ProcessInfo.processInfo.environment["UITEST_AMOUNTS_HIDDEN"] == "1"
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

    /// Which data state the chart fixture stands in. The card reads one plot across all of
    /// them, so they are worth seeing side by side rather than one at a time.
    private var chartState: String {
        ProcessInfo.processInfo.environment["UITEST_CHART_STATE"] ?? "onPlan"
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
                // The production tab, not a bare stack around the same view: every shortcut
                // on the accueil pushes through `appState.currentMonthPath`, so an unbound
                // stack turns all five of them into silent no-ops here — and a stack that
                // redeclares its own destinations drifts from the real one instead.
                CurrentMonthTab()
            }
        case .contextualCreationBudget:
            // Bare stack on purpose: this scenario only exercises the toolbar. It is the
            // trap the branch above documents, though — the router is bound, so any push
            // from a line lands on `currentMonthPath` while this unbound stack shows
            // nothing. A test that needs push navigation renders the production tab.
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
                fallbackPlannedBalance: fixture.plannedBalance,
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
        let state = chartState
        let referenceDate = chartReferenceDate(for: state)
        let payDay = isShiftedPeriod ? 27 : nil
        let budgetMonth = isShiftedPeriod ? 3 : 7
        let monthName = isShiftedPeriod ? "mars" : "juillet"
        let budget = Budget(
            id: budgetId, month: budgetMonth, year: 2026,
            description: "Chart UI Test", userId: "ui-test-user", templateId: "ui-test-template",
            endingBalance: 2_500, rollover: nil, remaining: 2_500, previousBudgetId: nil,
            createdAt: referenceDate, updatedAt: referenceDate
        )
        // The fixture states its data and lets the formulas say what the card shows. Hand-set
        // metrics beside a computed trajectory would let the screenshots show a hero that
        // its own plot cannot reach — the one thing this matrix exists to catch.
        let budgetLines = chartBudgetLines
        let transactions = chartTransactions(for: state)
        let metrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions
        )
        guard let trajectory = BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: budgetLines,
            transactions: transactions,
            budget: budget,
            payDayOfMonth: payDay,
            referenceDate: referenceDate
        ) else {
            preconditionFailure("Chart UI test trajectory must exist")
        }
        return ChartFixture(
            metrics: metrics,
            plannedBalance: trajectory.plannedBalance,
            trajectory: trajectory,
            monthName: monthName
        )
    }

    /// Where the period stands when the fixture is read. Two states move it: the last day,
    /// which has nothing left to project, and the first, where a new account meets this card
    /// with a single reading to draw.
    private func chartReferenceDate(for state: String) -> Date {
        guard !isShiftedPeriod else { return Self.date(year: 2026, month: 3, day: 10) }
        return switch state {
        case "lastDay": Self.date(year: 2026, month: 7, day: 31)
        case "firstDay": Self.date(year: 2026, month: 7, day: 1)
        default: Self.date(year: 2026, month: 7, day: 15)
        }
    }

    /// 5 000 in, 3 500 out: the plan lands on 1 500, and every state below moves away from
    /// that one figure — or deliberately fails to.
    private var chartBudgetLines: [BudgetLine] {
        [
            line(id: "salary", name: "Salaire", amount: 5_000, kind: .income),
            line(id: "rent", name: "Loyer", amount: 2_000, kind: .expense),
            line(id: "food", name: "Courses", amount: 800, kind: .expense),
            line(id: "savings", name: "Épargne", amount: 700, kind: .saving),
        ]
    }

    private func chartTransactions(for state: String) -> [Transaction] {
        let days = isShiftedPeriod
            ? [
                Self.date(year: 2026, month: 2, day: 28),
                Self.date(year: 2026, month: 3, day: 4),
                Self.date(year: 2026, month: 3, day: 9),
            ]
            : [
                Self.date(year: 2026, month: 7, day: 2),
                Self.date(year: 2026, month: 7, day: 8),
                Self.date(year: 2026, month: 7, day: 14),
            ]
        switch state {
        case "untouched", "firstDay":
            return []
        case "quiet":
            // 60 over the food envelope: a real gap, and far under the plot's own scale
            // floor. The frame has to size itself on what the period planned to spend, or
            // this month reads as the collapse it is not.
            return [transaction(id: "groceries", amount: 860, budgetLineId: "food", date: days[1])]
        case "onPlan":
            // Spent inside the envelopes, so the forecast is confirmed rather than changed.
            // The line has to stay on its rule here, which is the state the old curve got
            // wrong: it fell by the rent the day the rent was ticked.
            return [
                transaction(id: "rent", amount: 2_000, budgetLineId: "rent", date: days[0]),
                transaction(id: "groceries", amount: 500, budgetLineId: "food", date: days[1]),
            ]
        case "gain":
            return [transaction(id: "bonus", amount: 400, kind: .income, date: days[1])]
        case "deficit":
            return [transaction(id: "repair", amount: 2_600, date: days[1])]
        default:
            return [
                transaction(id: "rent", amount: 2_000, budgetLineId: "rent", date: days[0]),
                transaction(id: "impulse", amount: 700, date: days[2]),
            ]
        }
    }

    private func line(
        id: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind
    ) -> BudgetLine {
        BudgetLine(
            id: "chart-\(id)",
            budgetId: budgetId,
            templateLineId: nil,
            savingsGoalId: nil,
            name: name,
            amount: amount,
            kind: kind,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Self.date(year: 2026, month: 1, day: 1),
            updatedAt: Self.date(year: 2026, month: 1, day: 1)
        )
    }

    private func transaction(
        id: String,
        amount: Decimal,
        kind: TransactionKind = .expense,
        budgetLineId: String? = nil,
        date: Date
    ) -> Transaction {
        Transaction(
            id: "chart-\(id)",
            budgetId: budgetId,
            budgetLineId: budgetLineId.map { "chart-\($0)" },
            name: id,
            amount: amount,
            kind: kind,
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

private func marketingGainTransactions(
    budgetId: String,
    period: BudgetPeriod,
    now: Date
) -> [Transaction] {
    guard ProcessInfo.processInfo.environment["UITEST_HOME_MARKETING_GAIN"] == "1" else {
        return []
    }
    let start = BudgetPeriodCalculator.periodDates(
        month: period.month,
        year: period.year,
        payDayOfMonth: nil
    ).startDate
    let elapsed = max(now.timeIntervalSince(start), 0)
    let entries = [
        MarketingGainEntry(id: "freelance", name: "Mission freelance", amount: 200),
        MarketingGainEntry(id: "sale", name: "Vente", amount: 250),
        MarketingGainEntry(id: "bonus", name: "Bonus", amount: 350),
    ]
    return entries.enumerated().map { index, entry in
        Transaction(
            id: "marketing-\(entry.id)", budgetId: budgetId, budgetLineId: nil,
            name: entry.name, amount: entry.amount, kind: .income,
            transactionDate: start.addingTimeInterval(elapsed * Double(index + 1) / 4),
            category: nil, checkedAt: now, createdAt: now, updatedAt: now
        )
    }
}

private struct MarketingGainEntry {
    let id: String
    let name: String
    let amount: Decimal
}
