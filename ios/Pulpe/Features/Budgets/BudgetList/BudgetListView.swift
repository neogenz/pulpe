import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
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
            expandedYears = [Date().year]
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
                    ForEach(Array(store.groupedByYear.enumerated()), id: \.element.year) { _, group in
                        YearSection(
                            year: group.year,
                            budgets: group.budgets,
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
    let isExpanded: Bool
    let onToggle: () -> Void
    let onSelect: (BudgetSparse) -> Void
    let onCreateBudget: (Int, Int) -> Void

    @State private var expandTrigger = false

    private var layoutData: YearSectionLayoutData {
        YearSectionLayoutData(year: year, budgets: budgets)
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
                    CurrentMonthHeroCard(budget: current) {
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
            ForEach(Array(months.enumerated()), id: \.element.month) { index, slot in
                if let budget = slot.budget {
                    BudgetMonthRow(budget: budget) {
                        onSelect(budget)
                    }
                } else {
                    NextMonthPlaceholder(month: slot.month, year: year) {
                        onCreateBudget(slot.month, year)
                    }
                }

                if index < months.count - 1 {
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

    init(year: Int, budgets: [BudgetSparse]) {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = now.year

        self.isCurrentYear = year == currentYear
        self.isPastYear = year < currentYear
        var slots: [MonthSlot] = budgets.compactMap { budget in
            guard let month = budget.month else { return nil }
            return MonthSlot(month: month, budget: budget)
        }
        if year >= currentYear {
            let startMonth = (year == currentYear) ? currentMonth : 1
            for month in startMonth ... 12 where !budgets.contains { $0.month == month } {
                slots.append(MonthSlot(month: month, budget: nil))
                break
            }
        }

        let visibleMonths = slots.sorted { $0.month < $1.month }
        self.currentMonthBudget = budgets.first { $0.isCurrentMonth }
        var before: [MonthSlot] = []
        var after: [MonthSlot] = []
        var all: [MonthSlot] = []

        for slot in visibleMonths {
            let isCurrent = slot.budget?.isCurrentMonth == true
            if !isCurrent {
                all.append(slot)
                if slot.month < currentMonth {
                    before.append(slot)
                } else if slot.month > currentMonth {
                    after.append(slot)
                }
            }
        }

        self.monthsBefore = before
        self.monthsAfter = after
        self.allMonths = all
    }
}
