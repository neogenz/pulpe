import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showCreateBudget = false
    @State private var createBudgetTarget: (month: Int, year: Int)?
    @State private var hasAppeared = false
    @State private var expandedYears: Set<Int> = []

    var body: some View {
        Group {
            if !store.hasLoadedOnce && store.budgets.isEmpty {
                LoadingView(message: "Récupération de tes budgets...")
            } else if let error = store.error, store.budgets.isEmpty {
                ErrorView(error: error) {
                    await store.forceRefresh()
                }
            } else if store.budgets.isEmpty {
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Image(systemName: "chart.bar.doc.horizontal")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.textTertiary)
                    Text("Aucun budget")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Créez votre premier budget pour commencer à suivre vos dépenses")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textTertiary)
                        .multilineTextAlignment(.center)
                    Button("Créer un budget") {
                        showCreateBudget = true
                    }
                    .primaryButtonStyle()
                }
                .padding(DesignTokens.Spacing.xxxl)
            } else {
                budgetList
            }
        }
        .navigationTitle("Budgets")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                createButton
            }
        }
        .sheet(isPresented: $showCreateBudget) {
            if let nextMonth = store.nextAvailableMonth {
                CreateBudgetView(
                    month: nextMonth.month,
                    year: nextMonth.year
                ) { budget in
                    store.addBudget(budget)
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { createBudgetTarget != nil },
            set: { if !$0 { createBudgetTarget = nil } }
        )) {
            if let target = createBudgetTarget {
                CreateBudgetView(
                    month: target.month,
                    year: target.year
                ) { budget in
                    store.addBudget(budget)
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                }
            }
        }
        .refreshable {
            await store.forceRefresh()
        }
        .task {
            await store.loadIfNeeded()
            let currentPeriod = BudgetPeriodCalculator.periodForDate(
                Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
            )
            expandedYears = [currentPeriod.year]
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(.easeOut(duration: 0.25)) {
                    hasAppeared = true
                }
            }
        }
    }

    private var createButton: some View {
        Button {
            showCreateBudget = true
        } label: {
            Image(systemName: "plus")
        }
        .disabled(store.nextAvailableMonth == nil)
        .accessibilityLabel("Créer un nouveau budget")
    }

    private var budgetList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: DesignTokens.Spacing.xl) {
                    ForEach(store.groupedByYear, id: \.year) { group in
                        YearSection(
                            year: group.year,
                            budgets: group.budgets,
                            payDayOfMonth: userSettingsStore.payDayOfMonth,
                            isExpanded: expandedYears.contains(group.year),
                            onToggle: {
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    if expandedYears.contains(group.year) {
                                        expandedYears.remove(group.year)
                                    } else {
                                        expandedYears.insert(group.year)
                                    }
                                }
                            },
                            onSelect: { budget in
                                appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                            },
                            onCreateBudget: { month, year in
                                createBudgetTarget = (month, year)
                            }
                        )
                        .opacity(hasAppeared ? 1 : 0)
                        .animation(.easeOut(duration: 0.2), value: hasAppeared)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .scrollIndicators(.automatic)
            .onChange(of: hasAppeared) { _, appeared in
                if appeared {
                    scrollToCurrentMonth(proxy: proxy)
                }
            }
        }
        .pulpeBackground()
    }

    private func scrollToCurrentMonth(proxy: ScrollViewProxy) {
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            withAnimation(.easeOut(duration: 0.5)) {
                proxy.scrollTo("currentMonthHero", anchor: .center)
            }
        }
    }
}

struct YearSection: View {
    let year: Int
    let budgets: [BudgetSparse]
    var payDayOfMonth: Int?
    let isExpanded: Bool
    let onToggle: () -> Void
    let onSelect: (BudgetSparse) -> Void
    let onCreateBudget: (Int, Int) -> Void

    @State private var expandTrigger = false

    private var layoutData: YearSectionLayoutData {
        YearSectionLayoutData(year: year, budgets: budgets, payDayOfMonth: payDayOfMonth)
    }

    private var yearEndRemaining: Decimal? {
        budgets.max { ($0.month ?? 0) < ($1.month ?? 0) }?.remaining
    }

    var body: some View {
        let data = layoutData
        VStack(alignment: .leading, spacing: 14) {
            yearHeaderView(data: data)

            if isExpanded {
                expandedContent(data: data)
                    .transition(.opacity)
            }
        }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: expandTrigger)
        .onChange(of: isExpanded) { _, _ in
            expandTrigger.toggle()
        }
    }

    @ViewBuilder
    private func expandedContent(data: YearSectionLayoutData) -> some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            if data.currentMonthBudget != nil {
                if !data.monthsBefore.isEmpty {
                    monthListCard(months: data.monthsBefore)
                }
                if let current = data.currentMonthBudget {
                    CurrentMonthHeroCard(
                        budget: current,
                        periodLabel: current.month.flatMap { month in
                            current.year.flatMap { year in
                                BudgetPeriodCalculator.formatPeriod(
                                    month: month, year: year, payDayOfMonth: payDayOfMonth
                                )
                            }
                        }
                    ) {
                        onSelect(current)
                    }
                    .id("currentMonthHero")
                }
                if !data.monthsAfter.isEmpty {
                    monthListCard(months: data.monthsAfter)
                }
            } else if !data.allMonths.isEmpty {
                monthListCard(months: data.allMonths)
            }
        }
    }

    private func yearHeaderView(data: YearSectionLayoutData) -> some View {
        Button(action: onToggle) {
            HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(data.isPastYear ? .quaternary : .tertiary)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                Text(String(year))
                    .font(PulpeTypography.stepTitle)
                    .foregroundStyle(data.isPastYear ? .secondary : .primary)
                if data.isCurrentYear {
                    enCoursBadge
                }

                Spacer()
                if let endBalance = yearEndRemaining {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Image(systemName: endBalance >= 0 ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 11, weight: .bold))
                        Text(endBalance.asCompactCHF)
                            .font(PulpeTypography.labelLarge)
                            .monospacedDigit()
                    }
                    .foregroundStyle(endBalance >= 0 ? Color.financialSavings : .financialOverBudget)
                    .sensitiveAmount()
                }
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Année \(year)")
        .accessibilityHint(isExpanded ? "Appuie pour réduire" : "Appuie pour développer")
        .accessibilityAddTraits(.isHeader)
    }

    private var enCoursBadge: some View {
        Text("En cours")
            .font(PulpeTypography.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(Color.pulpePrimary)
            .padding(.horizontal, DesignTokens.Spacing.sm)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
    }

    private func monthListCard(months: [MonthSlot]) -> some View {
        VStack(spacing: 0) {
            ForEach(months, id: \.month) { slot in
                if let budget = slot.budget {
                    BudgetMonthRow(
                        budget: budget,
                        periodLabel: budget.month.flatMap { month in
                            budget.year.flatMap { year in
                                BudgetPeriodCalculator.formatPeriod(
                                    month: month, year: year, payDayOfMonth: payDayOfMonth
                                )
                            }
                        },
                        payDayOfMonth: payDayOfMonth
                    ) {
                        onSelect(budget)
                    }
                } else {
                    NextMonthPlaceholder(month: slot.month, year: year) {
                        onCreateBudget(slot.month, year)
                    }
                }

                if slot.month != months.last?.month {
                    Divider()
                        .padding(.leading, 34)
                }
            }
        }
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.lg)
    }
}

private struct MonthSlot {
    let month: Int
    let budget: BudgetSparse?
}

private struct YearSectionLayoutData {
    let isCurrentYear: Bool
    let isPastYear: Bool
    let currentMonthBudget: BudgetSparse?
    let monthsBefore: [MonthSlot]
    let monthsAfter: [MonthSlot]
    let allMonths: [MonthSlot]

    init(year: Int, budgets: [BudgetSparse], payDayOfMonth: Int? = nil) {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)

        self.isCurrentYear = year == currentPeriod.year
        self.isPastYear = year < currentPeriod.year
        var slots: [MonthSlot] = budgets.compactMap { budget in
            guard let month = budget.month else { return nil }
            return MonthSlot(month: month, budget: budget)
        }
        if year >= currentPeriod.year {
            let startMonth = (year == currentPeriod.year) ? currentPeriod.month : 1
            for month in startMonth ... 12 where !budgets.contains(where: { $0.month == month }) {
                slots.append(MonthSlot(month: month, budget: nil))
                break
            }
        }

        let visibleMonths = slots.sorted { $0.month < $1.month }
        self.currentMonthBudget = budgets.first { $0.isCurrentPeriod(payDayOfMonth: payDayOfMonth) }
        var before: [MonthSlot] = []
        var after: [MonthSlot] = []
        var all: [MonthSlot] = []

        for slot in visibleMonths {
            let isCurrent = slot.budget?.isCurrentPeriod(payDayOfMonth: payDayOfMonth) == true
            if !isCurrent {
                all.append(slot)
                if slot.month < currentPeriod.month {
                    before.append(slot)
                } else if slot.month > currentPeriod.month {
                    after.append(slot)
                }
            }
        }

        self.monthsBefore = before
        self.monthsAfter = after
        self.allMonths = all
    }
}
